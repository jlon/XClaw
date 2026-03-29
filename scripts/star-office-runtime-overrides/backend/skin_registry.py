import json
import os
import shutil
import uuid
from pathlib import Path


FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"
FRONTEND_DIR_RESOLVED = FRONTEND_DIR.resolve()
SKINS_ROOT = FRONTEND_DIR / "skins"
ALLOWED_ASSET_EXTENSIONS = {".png", ".webp", ".jpg", ".jpeg", ".gif", ".svg", ".avif"}
CURRENT_APPLIED_SKIN_KEY = None


def _registry_path() -> Path:
    return SKINS_ROOT / "registry.json"


def _read_json(path: Path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None


def _normalize_text(value, fallback):
    return value.strip() if isinstance(value, str) and value.strip() else fallback


def _normalize_bool(value, fallback):
    return value if isinstance(value, bool) else fallback


def _normalize_relative_path(value, fallback=""):
    text = _normalize_text(value, fallback)
    if not text:
        return fallback
    normalized = Path(text.replace("\\", "/"))
    if normalized.is_absolute():
        return fallback
    if any(part in {"..", "."} for part in normalized.parts):
        return fallback
    return normalized.as_posix()


def _normalize_skin(entry):
    if not isinstance(entry, dict):
        return None
    key = _normalize_text(entry.get("key"), "")
    if not key:
        return None
    return {
        "key": key,
        "name": _normalize_text(entry.get("name"), key),
        "enabled": _normalize_bool(entry.get("enabled"), True),
        "selectable": _normalize_bool(entry.get("selectable"), True),
        "isDefaultFallback": _normalize_bool(entry.get("isDefaultFallback"), False),
        "manifestPath": _normalize_relative_path(entry.get("manifestPath"), f"{key}/manifest.json"),
    }


def _fallback_registry():
    return {
        "defaultFallbackSkinKey": "lodge-default",
        "skins": [
            {
                "key": "lodge-default",
                "name": "Lodge Default",
                "enabled": True,
                "selectable": True,
                "isDefaultFallback": True,
                "manifestPath": "lodge-default/manifest.json",
            }
        ],
    }


def load_skin_registry():
    registry = _read_json(_registry_path())
    if not isinstance(registry, dict):
        return _fallback_registry()

    skins = [
        skin
        for skin in (
            _normalize_skin(entry)
            for entry in registry.get("skins", [])
            if isinstance(registry.get("skins"), list)
        )
        if skin is not None
    ]
    fallback_key = _normalize_text(registry.get("defaultFallbackSkinKey"), "")
    if not fallback_key:
        fallback_key = next((skin["key"] for skin in skins if skin.get("isDefaultFallback")), "lodge-default")

    return {
        "defaultFallbackSkinKey": fallback_key,
        "skins": skins,
    }


def _skin_lookup(registry):
    return {skin["key"]: skin for skin in registry.get("skins", []) if isinstance(skin, dict) and skin.get("key")}


def get_default_fallback_skin(registry=None):
    active_registry = registry or load_skin_registry()
    lookup = _skin_lookup(active_registry)
    fallback_key = _normalize_text(active_registry.get("defaultFallbackSkinKey"), "")
    fallback_skin = lookup.get(fallback_key) if fallback_key else None
    if fallback_skin is not None:
        return fallback_skin
    return next((skin for skin in active_registry.get("skins", []) if skin.get("isDefaultFallback")), None) or {
        "key": "lodge-default",
        "name": "Lodge Default",
        "enabled": True,
        "selectable": True,
        "isDefaultFallback": True,
        "manifestPath": "lodge-default/manifest.json",
    }


def _resolve_frontend_path(relative_path):
    normalized = _normalize_relative_path(relative_path, "")
    if not normalized:
        return None
    resolved = (FRONTEND_DIR / normalized).resolve()
    try:
        resolved.relative_to(FRONTEND_DIR_RESOLVED)
    except ValueError:
        return None
    return resolved


def load_skin_manifest(skin_key, registry=None):
    active_registry = registry or load_skin_registry()
    skin = _skin_lookup(active_registry).get(_normalize_text(skin_key, ""))
    if not skin:
        return None
    manifest_path = _resolve_frontend_path(f"skins/{skin['manifestPath']}")
    if not manifest_path or not manifest_path.is_file():
        return None
    manifest = _read_json(manifest_path)
    if not isinstance(manifest, dict):
        return None
    manifest["manifestPath"] = manifest_path.relative_to(FRONTEND_DIR_RESOLVED).as_posix()
    return manifest


def _normalize_manifest_assets(manifest):
    assets = manifest.get("assets")
    if not isinstance(assets, dict):
        return {}
    normalized = {}
    for raw_target, raw_source in assets.items():
        target = _normalize_relative_path(raw_target, "")
        source = _normalize_relative_path(raw_source, "")
        if not target or not source:
            continue
        normalized[target] = source
    return normalized


def _resolve_skin_plan(skin_key, registry=None, require_selectable=True):
    active_registry = registry or load_skin_registry()
    skin = _skin_lookup(active_registry).get(_normalize_text(skin_key, ""))
    if not skin or not skin.get("enabled"):
        return None
    if require_selectable and not skin.get("selectable"):
        return None
    manifest = load_skin_manifest(skin["key"], active_registry)
    if not manifest:
        return None
    return {
        "skin": skin,
        "manifest": manifest,
        "assets": _normalize_manifest_assets(manifest),
    }


def _validate_skin_plan(plan):
    if not plan or not plan.get("assets"):
        return False, [], "skin_assets_missing"

    validated_assets = []
    for target_rel, source_rel in plan["assets"].items():
        target_path = _resolve_frontend_path(target_rel)
        source_path = _resolve_frontend_path(source_rel)
        if not target_path or not source_path:
            return False, [], "invalid_asset_path"
        if target_path.parent != FRONTEND_DIR_RESOLVED:
            return False, [], "invalid_asset_target"
        if target_path.suffix.lower() not in ALLOWED_ASSET_EXTENSIONS:
            return False, [], "unsupported_asset_type"
        if source_path.suffix.lower() != target_path.suffix.lower():
            return False, [], "asset_extension_mismatch"
        if not source_path.is_file():
            return False, [], "skin_asset_missing"
        validated_assets.append(
            {
                "targetRelativePath": target_rel,
                "targetPath": target_path,
                "sourceRelativePath": source_rel,
                "sourcePath": source_path,
            }
        )

    return True, validated_assets, None


def _copy_asset_atomically(source_path: Path, target_path: Path):
    suffix = target_path.suffix or ".bin"
    staged_path = target_path.with_name(f".xclaw-skin-{target_path.stem}-{uuid.uuid4().hex}{suffix}")
    try:
        shutil.copy2(source_path, staged_path)
        os.replace(staged_path, target_path)
    finally:
        if staged_path.exists():
            staged_path.unlink(missing_ok=True)


def _apply_validated_assets(validated_assets):
    for item in validated_assets:
        _copy_asset_atomically(item["sourcePath"], item["targetPath"])
    return [item["targetRelativePath"] for item in validated_assets]


def _set_current_applied_skin_key(skin_key):
    global CURRENT_APPLIED_SKIN_KEY
    CURRENT_APPLIED_SKIN_KEY = _normalize_text(skin_key, None)


def _get_current_applied_skin_key(registry=None):
    fallback_skin = get_default_fallback_skin(registry)
    return _normalize_text(CURRENT_APPLIED_SKIN_KEY, fallback_skin["key"])


def build_skin_snapshot(registry=None):
    active_registry = registry or load_skin_registry()
    return {
        "defaultFallbackSkinKey": active_registry.get("defaultFallbackSkinKey", "lodge-default"),
        "currentAppliedSkinKey": _get_current_applied_skin_key(active_registry),
        "skins": active_registry.get("skins", []),
    }


def _build_failure_result(registry, reason, fallback_skin, fallback_applied, refreshed_assets):
    current_applied_skin_key = fallback_skin["key"] if fallback_applied else _get_current_applied_skin_key(registry)
    if fallback_applied:
        _set_current_applied_skin_key(current_applied_skin_key)
    return {
        "ok": False,
        "appliedSkinKey": fallback_skin["key"],
        "currentAppliedSkinKey": current_applied_skin_key,
        "fallbackApplied": fallback_applied,
        "refreshedAssets": refreshed_assets,
        "reason": reason,
        **build_skin_snapshot(registry),
    }


def _apply_fallback_skin(registry, reason):
    fallback_skin = get_default_fallback_skin(registry)
    fallback_plan = _resolve_skin_plan(fallback_skin["key"], registry, require_selectable=False)
    valid, validated_assets, validation_reason = _validate_skin_plan(fallback_plan)
    if not valid:
        return _build_failure_result(registry, validation_reason or reason, fallback_skin, False, [])

    try:
        refreshed_assets = _apply_validated_assets(validated_assets)
        _set_current_applied_skin_key(fallback_skin["key"])
        return _build_failure_result(registry, reason, fallback_skin, True, refreshed_assets)
    except Exception:
        return _build_failure_result(registry, reason, fallback_skin, False, [])


def build_apply_result(payload=None):
    registry = load_skin_registry()
    fallback_skin = get_default_fallback_skin(registry)
    requested_skin_key = ""
    if isinstance(payload, dict):
        requested_skin_key = _normalize_text(payload.get("skinKey") or payload.get("requestedSkinKey"), "")

    if not requested_skin_key:
        return _apply_fallback_skin(registry, "skin_key_missing")

    plan = _resolve_skin_plan(requested_skin_key, registry, require_selectable=True)
    valid, validated_assets, validation_reason = _validate_skin_plan(plan)
    if not valid:
        return _apply_fallback_skin(registry, validation_reason or "skin_not_available")

    try:
        refreshed_assets = _apply_validated_assets(validated_assets)
        _set_current_applied_skin_key(requested_skin_key)
        return {
            "ok": True,
            "appliedSkinKey": requested_skin_key,
            "currentAppliedSkinKey": requested_skin_key,
            "fallbackApplied": False,
            "refreshedAssets": refreshed_assets,
            "reason": None,
            **build_skin_snapshot(registry),
        }
    except Exception:
        return _apply_fallback_skin(registry, "skin_apply_failed")
