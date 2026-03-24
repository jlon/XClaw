#!/usr/bin/env bash
set -euo pipefail

repo="${XCLAW_RELEASE_REPO:-jlon/XClaw}"
target_dir="${XCLAW_DOWNLOAD_DIR:-/var/www/xclaw/downloads}"
api_url="https://api.github.com/repos/${repo}/releases?per_page=1"
dry_run="false"

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

json="$(curl -fsSL -H 'Accept: application/vnd.github+json' "$api_url")"

selection="$(
  python3 - <<'PY' "$json"
import json
import re
import sys

payload = json.loads(sys.argv[1])
if not payload:
    raise SystemExit("No releases were returned by GitHub.")

release = payload[0]
assets = release.get("assets", [])

rules = {
    "macArm64": [r"-mac-arm64\.dmg$"],
    "macX64": [r"-mac-x64\.dmg$"],
    "win": [r"-win-x64\.exe$", r"-win\.exe$", r"-win-arm64\.exe$"],
}

picked = {}
for stable_name, patterns in rules.items():
    for pattern in patterns:
        match = next((asset for asset in assets if re.search(pattern, asset["name"])), None)
        if match:
            picked[stable_name] = match
            break
    if stable_name not in picked:
        raise SystemExit(f"Required asset was not found for {stable_name}.")

print(release["tag_name"])
for key in ("macArm64", "macX64", "win"):
    asset = picked[key]
    print("\t".join((key, asset["name"], str(asset["size"]), asset["updated_at"], asset["browser_download_url"])))
PY
)"

tag="$(printf '%s\n' "$selection" | sed -n '1p')"
mapfile -t selected_assets < <(printf '%s\n' "$selection" | tail -n +2)

declare -A asset_names=()
declare -A asset_sizes=()
declare -A asset_updated_at=()
declare -A asset_urls=()
declare -A current_names=()
declare -A current_sizes=()
declare -A current_updated_at=()
current_tag=""

if [[ "${#selected_assets[@]}" -ne 3 ]]; then
  echo "Expected 3 download assets, got ${#selected_assets[@]}." >&2
  exit 1
fi

echo "Release tag: $tag"
for line in "${selected_assets[@]}"; do
  IFS=$'\t' read -r key source_name size updated_at url <<<"$line"
  asset_names["$key"]="$source_name"
  asset_sizes["$key"]="$size"
  asset_updated_at["$key"]="$updated_at"
  asset_urls["$key"]="$url"
  echo "  $key <= $source_name"
  echo "    $url"
done

if [[ "$dry_run" == "true" ]]; then
  exit 0
fi

mkdir -p "$target_dir"
tmp_dir="$(mktemp -d "${target_dir%/}/.sync.XXXXXX")"
trap 'rm -rf "$tmp_dir"' EXIT
version_dir="${target_dir%/}/$tag"
mkdir -p "$version_dir"

if [[ -f "${target_dir%/}/latest.json" ]]; then
  current_selection="$(
    python3 - <<'PY' "${target_dir%/}/latest.json"
import json
import sys
from pathlib import Path

payload = json.loads(Path(sys.argv[1]).read_text())
print(payload.get("tag", ""))
for key, value in payload.get("downloads", {}).items():
    print("\t".join((
        key,
        str(value.get("name", "")),
        str(value.get("size", "")),
        str(value.get("updatedAt", "")),
    )))
PY
  )"
  current_tag="$(printf '%s\n' "$current_selection" | sed -n '1p')"
  while IFS=$'\t' read -r key name size updated_at; do
    [[ -n "$key" ]] || continue
    current_names["$key"]="$name"
    current_sizes["$key"]="$size"
    current_updated_at["$key"]="$updated_at"
  done < <(printf '%s\n' "$current_selection" | tail -n +2)
fi

for key in macArm64 macX64 win; do
  name="${asset_names[$key]}"
  size="${asset_sizes[$key]}"
  updated_at="${asset_updated_at[$key]}"
  url="${asset_urls[$key]}"
  target_path="${version_dir}/${name}"

  if [[ "$current_tag" == "$tag" ]] \
    && [[ "${current_names[$key]:-}" == "$name" ]] \
    && [[ "${current_sizes[$key]:-}" == "$size" ]] \
    && [[ "${current_updated_at[$key]:-}" == "$updated_at" ]] \
    && [[ -f "$target_path" ]] \
    && [[ "$(file_size "$target_path")" == "$size" ]]; then
    echo "Skip existing file: $target_path"
    continue
  fi

  curl -fL --progress-bar "$url" -o "$tmp_dir/$name"
  [[ -s "$tmp_dir/$name" ]]

  if [[ "$(file_size "$tmp_dir/$name")" != "$size" ]]; then
    echo "Downloaded size mismatch for $name." >&2
    exit 1
  fi

  chmod 0644 "$tmp_dir/$name"
  mv -f "$tmp_dir/$name" "$target_path"
done

cat >"$tmp_dir/latest.json" <<EOF
{
  "tag": "$tag",
  "syncedAtUtc": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "downloads": {
    "macArm64": {
      "name": "${asset_names[macArm64]}",
      "url": "/downloads/$tag/${asset_names[macArm64]}",
      "size": ${asset_sizes[macArm64]},
      "updatedAt": "${asset_updated_at[macArm64]}"
    },
    "macX64": {
      "name": "${asset_names[macX64]}",
      "url": "/downloads/$tag/${asset_names[macX64]}",
      "size": ${asset_sizes[macX64]},
      "updatedAt": "${asset_updated_at[macX64]}"
    },
    "win": {
      "name": "${asset_names[win]}",
      "url": "/downloads/$tag/${asset_names[win]}",
      "size": ${asset_sizes[win]},
      "updatedAt": "${asset_updated_at[win]}"
    }
  }
}
EOF
chmod 0644 "$tmp_dir/latest.json"
mv -f "$tmp_dir/latest.json" "${target_dir%/}/latest.json"

trap - EXIT
rm -rf "$tmp_dir"

echo "Synced downloads to $version_dir"
