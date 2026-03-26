import re


_NAME_FIELD_PATTERNS = (
    re.compile(r"^\*\*(?:Name|名字|名称)\s*[:：]\*\*\s*(.*)$", re.IGNORECASE),
    re.compile(r"^\*\*(?:Name|名字|名称)\*\*\s*[:：]\s*(.*)$", re.IGNORECASE),
    re.compile(r"^(?:Name|名字|名称)\s*[:：]\s*(.*)$", re.IGNORECASE),
)


def _normalize_display_name(value):
    if not isinstance(value, str):
        return None
    normalized = re.sub(r"\s+", " ", value).strip()
    return normalized or None


def _unwrap_inline_markup(value):
    current = value.strip()
    while True:
        next_value = current
        if current.startswith("**") and current.endswith("**") and len(current) > 4:
            next_value = current[2:-2].strip()
        elif current.startswith("__") and current.endswith("__") and len(current) > 4:
            next_value = current[2:-2].strip()
        elif current.startswith("*") and current.endswith("*") and len(current) > 2:
            next_value = current[1:-1].strip()
        elif current.startswith("_") and current.endswith("_") and len(current) > 2:
            next_value = current[1:-1].strip()
        elif current.startswith("`") and current.endswith("`") and len(current) > 2:
            next_value = current[1:-1].strip()
        if next_value == current:
            return current
        current = next_value


def _normalize_identity_candidate(value):
    normalized = _normalize_display_name(_unwrap_inline_markup(value))
    if not normalized:
        return None
    probe = normalized.strip()
    if probe.startswith(("(", "（")) and probe.endswith((")", "）")):
        probe = probe[1:-1].strip()
    if "pick something you like" in probe.casefold():
        return None
    return normalized


def _parse_name_field_line(line):
    normalized = re.sub(r"^\s*[-*]\s*", "", line).strip()
    if not normalized:
        return None
    for pattern in _NAME_FIELD_PATTERNS:
        match = pattern.match(normalized)
        if match:
            return (match.group(1) or "").strip()
    return None


def parse_identity_name(content):
    lines = content.splitlines()
    for index, line in enumerate(lines):
        inline_value = _parse_name_field_line(line)
        if inline_value is None:
            continue
        if inline_value:
            return _normalize_identity_candidate(inline_value)
        for next_line in lines[index + 1:]:
            stripped = next_line.strip()
            if not stripped:
                continue
            if _parse_name_field_line(next_line) is not None:
                return None
            return _normalize_identity_candidate(stripped)
        return None
    return None
