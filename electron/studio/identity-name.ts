const NAME_FIELD_PATTERNS = [
  /^\*\*(?:Name|名字|名称)\s*[:：]\*\*\s*(.*)$/iu,
  /^\*\*(?:Name|名字|名称)\*\*\s*[:：]\s*(.*)$/iu,
  /^(?:Name|名字|名称)\s*[:：]\s*(.*)$/iu,
];

const normalizeDisplayName = (value: string | null | undefined): string | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length > 0 ? normalized : null;
};

const unwrapInlineMarkup = (value: string): string => {
  let current = value.trim();
  while (true) {
    const next = (
      (current.startsWith('**') && current.endsWith('**') && current.length > 4)
        ? current.slice(2, -2).trim()
        : (current.startsWith('__') && current.endsWith('__') && current.length > 4)
          ? current.slice(2, -2).trim()
          : (current.startsWith('*') && current.endsWith('*') && current.length > 2)
            ? current.slice(1, -1).trim()
            : (current.startsWith('_') && current.endsWith('_') && current.length > 2)
              ? current.slice(1, -1).trim()
              : (current.startsWith('`') && current.endsWith('`') && current.length > 2)
                ? current.slice(1, -1).trim()
                : current
    );
    if (next === current) {
      return current;
    }
    current = next;
  }
};

const normalizeIdentityCandidate = (value: string): string | null => {
  const normalized = normalizeDisplayName(unwrapInlineMarkup(value));
  if (!normalized) {
    return null;
  }
  const probe = normalized.replace(/^[（(]\s*|\s*[）)]$/gu, '').trim();
  if (/pick something you like/i.test(probe)) {
    return null;
  }
  return normalized;
};

const parseNameFieldLine = (line: string): string | null => {
  const normalized = line.replace(/^\s*[-*]\s*/, '').trim();
  if (!normalized) {
    return null;
  }
  for (const pattern of NAME_FIELD_PATTERNS) {
    const match = normalized.match(pattern);
    if (match) {
      return match[1]?.trim() ?? '';
    }
  }
  return null;
};

export const parseStudioIdentityName = (content: string): string | null => {
  const lines = content.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const inlineValue = parseNameFieldLine(lines[index]);
    if (inlineValue === null) {
      continue;
    }
    if (inlineValue) {
      return normalizeIdentityCandidate(inlineValue);
    }
    for (let lookahead = index + 1; lookahead < lines.length; lookahead += 1) {
      const nextLine = lines[lookahead].trim();
      if (!nextLine) {
        continue;
      }
      if (parseNameFieldLine(lines[lookahead]) !== null) {
        return null;
      }
      return normalizeIdentityCandidate(nextLine);
    }
    return null;
  }
  return null;
};
