import { readFile, writeFile } from 'node:fs/promises';
import { execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';

const seedPath = path.join(process.cwd(), 'electron/shared/agent-market-seed.json');
const FETCH_RETRY_COUNT = 3;
const METADATA_NOTE = 'Metadata fields are derived from upstream SOUL.md templates.';
const execFile = promisify(execFileCallback);

const sectionKindMap = new Map([
  ['core identity', 'identity'],
  ['identity', 'identity'],
  ['responsibilities', 'responsibilities'],
  ['capabilities', 'capabilities'],
  ['behavioral guidelines', 'behavior'],
  ['rules', 'rules'],
  ['communication style', 'communication'],
  ['integrations', 'integrations'],
  ['analysis framework', 'framework'],
  ['severity levels', 'severity'],
  ['weekly patterns', 'patterns'],
  ['example interactions', 'examples'],
]);

const preferredSectionOrder = [
  'identity',
  'responsibilities',
  'capabilities',
  'behavior',
  'communication',
  'integrations',
  'framework',
  'rules',
  'severity',
  'patterns',
  'examples',
];

const cleanInline = (value) =>
  value
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .replace(/`+/g, '')
    .replace(/\*\*/g, '')
    .replace(/[_*]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const sentenceCase = (value) => {
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized ? `${normalized.charAt(0).toUpperCase()}${normalized.slice(1)}` : normalized;
};

const uniqueItems = (items) => {
  const seen = new Set();
  return items.filter((item) => {
    const normalized = item.toLowerCase();
    if (!item || seen.has(normalized)) {
      return false;
    }
    seen.add(normalized);
    return true;
  });
};

const stripLeadingArticle = (value) => value.replace(/^(the|an|a)\s+/i, '').trim();
const stripSoulPrefix = (value) => value.replace(/^SOUL\.md\s*[—-]\s*/i, '').trim();
const isStructuralLabel = (value) => /^(do|don't|dont|opening|body|closing|tone)$/i.test(value.replace(/:$/, '').trim());
const normalizeIdentity = (value) => value.toLowerCase().replace(/[-_\s]+/g, ' ').trim();
const acronymMap = new Map([
  ['ux', 'UX'],
  ['ui', 'UI'],
  ['api', 'API'],
  ['qa', 'QA'],
  ['seo', 'SEO'],
  ['crm', 'CRM'],
  ['hr', 'HR'],
  ['jtbd', 'JTBD'],
  ['ml', 'ML'],
  ['ai', 'AI'],
  ['ar', 'AR'],
  ['vr', 'VR'],
]);

const titleCaseSlug = (value) =>
  value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => acronymMap.get(part.toLowerCase()) ?? `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`)
    .join(' ');

const isWeakRole = (value, item) => {
  const normalized = normalizeIdentity(value);
  return (
    !normalized ||
    normalized === normalizeIdentity(item.id) ||
    normalized === normalizeIdentity(item.name) ||
    normalized === normalizeIdentity(titleCaseSlug(item.id))
  );
};

const parseSections = (markdown) => {
  const lines = markdown.split(/\r?\n/);
  const title = cleanInline((lines.find((line) => line.startsWith('# ')) ?? '').replace(/^#\s+/, ''));
  const introLines = [];
  const sections = [];
  let current = null;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (/^##\s+/.test(line)) {
      current = {
        title: cleanInline(line.replace(/^##\s+/, '')),
        lines: [],
      };
      sections.push(current);
      continue;
    }

    if (current) {
      current.lines.push(line);
    } else if (!/^#\s+/.test(line)) {
      introLines.push(line);
    }
  }

  return { title, introLines, sections };
};

const parseSectionContent = (section) => {
  const paragraphs = [];
  const topLevelItems = [];
  const bulletItems = [];
  const keyValues = {};
  let paragraphBuffer = [];

  const flushParagraph = () => {
    if (paragraphBuffer.length === 0) {
      return;
    }
    const text = sentenceCase(cleanInline(paragraphBuffer.join(' ')));
    if (text) {
      paragraphs.push(text);
    }
    paragraphBuffer = [];
  };

  for (const rawLine of section.lines) {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      continue;
    }

    if (/^###\s+/.test(line)) {
      flushParagraph();
      const heading = cleanInline(line.replace(/^###\s+/, ''));
      if (heading && !isStructuralLabel(heading)) {
        bulletItems.push(heading);
      }
      continue;
    }

    const keyedBullet = line.match(/^[-*]\s+\*\*(.+?):\*\*\s*(.+)$/);
    if (keyedBullet) {
      flushParagraph();
      keyValues[keyedBullet[1].trim().toLowerCase()] = cleanInline(keyedBullet[2]);
      continue;
    }

    const numberedBold = line.match(/^\d+\.\s+\*\*(.+?)\*\*/);
    if (numberedBold) {
      flushParagraph();
      topLevelItems.push(cleanInline(numberedBold[1]));
      continue;
    }

    const bullet = line.match(/^[-*]\s+(.+)$/);
    if (bullet) {
      flushParagraph();
      const text = cleanInline(bullet[1]);
      if (!isStructuralLabel(text)) {
        bulletItems.push(text);
      }
      continue;
    }

    const numbered = line.match(/^\d+\.\s+(.+)$/);
    if (numbered) {
      flushParagraph();
      bulletItems.push(cleanInline(numbered[1]));
      continue;
    }

    paragraphBuffer.push(line);
  }

  flushParagraph();

  const kind = sectionKindMap.get(section.title.toLowerCase()) ?? 'details';
  const items = uniqueItems((topLevelItems.length > 0 ? topLevelItems : bulletItems).slice(0, 6));

  return {
    title: section.title,
    kind,
    keyValues,
    body: paragraphs[0] ?? '',
    items,
  };
};

const deriveIntroRole = (introLines) => {
  for (const line of introLines) {
    const text = cleanInline(line);
    const match =
      text.match(/^You are .*?, an? (.+?) powered by OpenClaw\b/i) ??
      text.match(/^You are .*?, the (.+?) powered by OpenClaw\b/i);
    if (match?.[1]) {
      return sentenceCase(match[1].replace(/^AI\s+/i, ''));
    }
  }
  return '';
};

const deriveIdentityRole = (identity) => {
  if (!identity?.body) {
    return '';
  }
  const text = cleanInline(identity.body);
  const match =
    text.match(/^You are .*?, an? (.+?) powered by OpenClaw\b/i) ??
    text.match(/^You are .*?, the (.+?) powered by OpenClaw\b/i);
  if (!match?.[1]) {
    return '';
  }
  return sentenceCase(match[1].replace(/^AI\s+/i, ''));
};

const isWeakName = (value, item) =>
  !value ||
  normalizeIdentity(value) === normalizeIdentity(item.id);

const deriveName = (title, item) => {
  const cleanedTitle = stripSoulPrefix(cleanInline(title.replace(/^Agent:\s*/i, '')));
  if (cleanedTitle) {
    const segments = cleanedTitle.split(/\s+[—-]\s+/).map((entry) => entry.trim()).filter(Boolean);
    if (segments.length > 1) {
      return sentenceCase(stripLeadingArticle(segments[segments.length - 1]));
    }
    return sentenceCase(stripLeadingArticle(cleanedTitle));
  }
  if (!isWeakName(item.name, item)) {
    return sentenceCase(cleanInline(item.name));
  }
  return titleCaseSlug(item.id);
};

const deriveHeadline = (title, fallbackName, fallbackId) => {
  const cleanedTitle = stripSoulPrefix(cleanInline(title.replace(/^Agent:\s*/i, '')));
  if (cleanedTitle) {
    const segments = cleanedTitle.split(/\s+[—-]\s+/).map((entry) => entry.trim()).filter(Boolean);
    const preferred = segments.length > 1 ? segments[segments.length - 1] : cleanedTitle;
    return sentenceCase(stripLeadingArticle(preferred));
  }
  return sentenceCase(cleanInline(fallbackName || titleCaseSlug(fallbackId)));
};

const composeIdentitySection = (summary, identitySection) => {
  if (!identitySection) {
    return null;
  }
  const personality = identitySection.keyValues.personality ? `Personality: ${identitySection.keyValues.personality}` : '';
  const communication = identitySection.keyValues.communication
    ? `Communication: ${identitySection.keyValues.communication}`
    : '';
  const items = uniqueItems([personality, communication]);
  return {
    kind: 'identity',
    title: identitySection.title,
    body: summary,
    items,
  };
};

const deriveHighlights = (sections) => {
  const preferred = ['responsibilities', 'capabilities', 'behavior', 'integrations', 'framework', 'rules', 'patterns'];
  const pool = preferred
    .map((kind) => sections.find((section) => section.kind === kind))
    .filter(Boolean);
  for (const section of pool) {
    if (section.items.length > 0) {
      return section.items.slice(0, 3);
    }
  }
  const fallback = sections.flatMap((section) => section.items).slice(0, 3);
  return uniqueItems(fallback);
};

const pickDetailSections = (parsedSections, summary) => {
  const identity = parsedSections.find((section) => section.kind === 'identity');
  const ordered = preferredSectionOrder.flatMap((kind) =>
    parsedSections.filter((section) => section.kind === kind && section.kind !== 'identity'),
  );
  const selected = [];
  const identitySection = composeIdentitySection(summary, identity);
  if (identitySection) {
    selected.push(identitySection);
  }
  for (const section of ordered) {
    if (selected.length >= 3) {
      break;
    }
    if (!section.body && section.items.length === 0) {
      continue;
    }
    selected.push({
      kind: section.kind,
      title: section.title,
      body: section.body,
      items: section.items.slice(0, 4),
    });
  }
  return selected;
};

const deriveMetadata = (item, markdown) => {
  const { title, introLines, sections } = parseSections(markdown);
  const parsedSections = sections.map(parseSectionContent);
  const identity = parsedSections.find((section) => section.kind === 'identity');
  const name = deriveName(title, item);
  const headline = deriveHeadline(title, name, item.id);
  const roleCandidate = isWeakRole(item.role, item) ? '' : item.role;
  const summary = sentenceCase(
    roleCandidate ||
      deriveIdentityRole(identity) ||
      identity?.keyValues.role ||
      deriveIntroRole(introLines) ||
      stripLeadingArticle(headline) ||
      titleCaseSlug(item.id),
  );
  const highlights = deriveHighlights(parsedSections);
  const detailSections = pickDetailSections(parsedSections, summary);
  const tags = uniqueItems(
    [item.category, headline, summary, ...highlights]
      .map((entry) => sentenceCase(entry))
      .filter(Boolean),
  ).slice(0, 8);

  return {
    ...item,
    name,
    role: item.role || summary,
    localeKey: item.id,
    avatarSeed: `${item.category}:${item.id}`,
    headline,
    summary,
    highlights,
    detailSections,
    tags,
  };
};

const fetchTextWithRetry = async (url) => {
  let lastError = null;
  for (let attempt = 1; attempt <= FETCH_RETRY_COUNT; attempt += 1) {
    try {
      const { stdout } = await execFile('curl', [
        '-L',
        '--fail',
        '--silent',
        '--show-error',
        '--connect-timeout',
        '30',
        '--max-time',
        '60',
        url,
      ]);
      const markdown = stdout;
      if (!markdown.trim()) {
        throw new Error(`Fetched empty content for ${url}`);
      }
      return markdown;
    } catch (error) {
      lastError = error;
      if (attempt < FETCH_RETRY_COUNT) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 400));
      }
    }
  }
  throw lastError;
};

const normalizeSourceNote = (note) => {
  const normalized = note.replace(new RegExp(`(?:\\s*${METADATA_NOTE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})+\\s*$`), '').trim();
  return normalized ? `${normalized} ${METADATA_NOTE}` : METADATA_NOTE;
};

const main = async () => {
  const seed = JSON.parse(await readFile(seedPath, 'utf8'));
  const items = await Promise.all(
    seed.items.map(async (item) => {
      const markdown = await fetchTextWithRetry(item.rawUrl);
      return deriveMetadata(item, markdown);
    }),
  );
  const nextSeed = {
    ...seed,
    version: seed.version + 1,
    source: {
      ...seed.source,
      note: normalizeSourceNote(seed.source.note),
    },
    items,
  };
  await writeFile(seedPath, `${JSON.stringify(nextSeed, null, 2)}\n`);
};

await main();
