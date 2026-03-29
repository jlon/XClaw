#!/usr/bin/env bash
set -euo pipefail

repo="${XCLAW_RELEASE_REPO:-jlon/XClaw}"
target_dir="${XCLAW_UPDATE_FEED_DIR:-/var/www/xclaw/downloads/updates}"
api_url="https://api.github.com/repos/${repo}/releases?per_page=30"
dry_run="false"
tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT
api_json_path="$tmp_dir/releases.json"
selection_json_path="$tmp_dir/selection.json"

file_size() {
  stat -c%s "$1" 2>/dev/null || stat -f%z "$1"
}

for arg in "$@"; do
  case "$arg" in
    --dry-run)
      dry_run="true"
      ;;
    *)
      echo "Unknown argument: $arg" >&2
      echo "Usage: $(basename "$0") [--dry-run]" >&2
      exit 1
      ;;
  esac
done

curl -fsSL -H 'Accept: application/vnd.github+json' "$api_url" -o "$api_json_path"

python3 - <<'PY' "$api_json_path" "$selection_json_path"
import json
import re
import sys
from pathlib import Path

payload = json.loads(open(sys.argv[1], encoding="utf-8").read())
selection_path = Path(sys.argv[2])
if not payload:
    raise SystemExit("No releases were returned by GitHub.")

def select_beta_release():
    for release in payload:
        tag = str(release.get("tag_name", ""))
        prerelease = bool(release.get("prerelease"))
        if "beta" in tag.lower() or prerelease:
            return release
    raise SystemExit("Could not find a beta release.")

def canonical_name(name: str) -> str:
    if not name.endswith(".yml"):
        return name
    return re.sub(r"^(alpha|beta|dev)", "latest", name)

def is_required_asset(name: str) -> bool:
    return (
        name.endswith(".blockmap")
        or (name.endswith(".yml") and name != "builder-debug.yml")
        or re.search(r"-win-x64\.exe$", name) is not None
        or re.search(r"-mac(?:-x64|-arm64)?\.dmg$", name) is not None
    )

def first_match(assets: list[dict], patterns: list[str]) -> dict:
    for pattern in patterns:
        matched = next((asset for asset in assets if re.search(pattern, asset["name"])), None)
        if matched:
            return matched
    raise SystemExit(f"Missing required asset for patterns: {patterns}")

release = select_beta_release()
assets = [asset for asset in release.get("assets", []) if is_required_asset(asset.get("name", ""))]
metadata_assets = [asset for asset in assets if asset["name"].endswith(".yml") and asset["name"] != "builder-debug.yml"]
canonical_metadata_names = {canonical_name(asset["name"]) for asset in metadata_assets}

if not metadata_assets:
    raise SystemExit("Missing yml metadata for beta.")
if "latest.yml" not in canonical_metadata_names:
    raise SystemExit("Missing canonical latest.yml for beta.")
if "latest-mac.yml" not in canonical_metadata_names:
    raise SystemExit("Missing canonical latest-mac.yml for beta.")
if not any(asset["name"].endswith(".blockmap") for asset in assets):
    raise SystemExit("Missing blockmap assets for beta.")
if not any(re.search(r"-win-x64\.exe$", asset["name"]) for asset in assets):
    raise SystemExit("Missing Windows installer for beta.")
if not any(re.search(r"-mac(?:-x64|-arm64)?\.dmg$", asset["name"]) for asset in assets):
    raise SystemExit("Missing macOS dmg for beta.")

downloads = {
    "macArm64": first_match(assets, [r"-mac-arm64\.dmg$"]),
    "macX64": first_match(assets, [r"-mac-x64\.dmg$"]),
    "winX64": first_match(assets, [r"-win-x64\.exe$"]),
}

selection_path.write_text(json.dumps({
    "channel": "beta",
    "tag": release["tag_name"],
    "version": str(release["tag_name"]).removeprefix("v"),
    "releaseDate": release.get("published_at") or release.get("created_at"),
    "assets": [
        {
            "name": asset["name"],
            "canonicalName": canonical_name(asset["name"]),
            "size": asset["size"],
            "updatedAt": asset["updated_at"],
            "url": asset["browser_download_url"],
        }
        for asset in assets
    ],
    "downloads": {
        key: {
            "name": asset["name"],
            "size": asset["size"],
            "updatedAt": asset["updated_at"],
            "url": f"/downloads/updates/beta/{asset['name']}",
        }
        for key, asset in downloads.items()
    },
}) + "\n", encoding="utf-8")
PY

if [[ "$dry_run" == "true" ]]; then
  cat "$selection_json_path"
  exit 0
fi

mkdir -p "$target_dir"
python3 - <<'PY' "$selection_json_path" "$tmp_dir/selection.tsv" "$tmp_dir/feed.json"
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

selection = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
selection_path = Path(sys.argv[2])
feed_path = Path(sys.argv[3])

with selection_path.open("w", encoding="utf-8") as handle:
    for asset in selection["assets"]:
        handle.write(
            "\t".join(
                [
                    asset["name"],
                    asset["canonicalName"],
                    str(asset["size"]),
                    asset["updatedAt"],
                    asset["url"],
                ]
            )
            + "\n"
        )

feed_payload = {
    "channel": selection["channel"],
    "tag": selection["tag"],
    "version": selection["version"],
    "releaseDate": selection.get("releaseDate"),
    "syncedAtUtc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    "downloads": selection["downloads"],
}
feed_path.write_text(json.dumps(feed_payload, indent=2) + "\n", encoding="utf-8")
PY

channel_dir="${target_dir%/}/beta"
mkdir -p "$channel_dir"

while IFS=$'\t' read -r name canonical size updated_at url; do
  tmp_file="$tmp_dir/$canonical"
  target_file="$channel_dir/$canonical"

  if [[ -f "$target_file" ]] && [[ "$(file_size "$target_file")" == "$size" ]]; then
    echo "Skip existing file: $target_file"
    continue
  fi

  curl -fL --progress-bar "$url" -o "$tmp_file"
  [[ -s "$tmp_file" ]]

  if [[ "$(file_size "$tmp_file")" != "$size" ]]; then
    echo "Downloaded size mismatch for $name." >&2
    exit 1
  fi

  chmod 0644 "$tmp_file"
  mv -f "$tmp_file" "$target_file"
  echo "Synced beta => $canonical"
done < "$tmp_dir/selection.tsv"

chmod 0644 "$tmp_dir/feed.json"
mv -f "$tmp_dir/feed.json" "$channel_dir/feed.json"

trap - EXIT
rm -rf "$tmp_dir"

echo "Synced beta updater feed to $channel_dir"
