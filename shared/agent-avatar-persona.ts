export type AgentAvatarArchetype =
  | 'builder'
  | 'analyst'
  | 'operator'
  | 'guardian'
  | 'researcher'
  | 'communicator'
  | 'creative'
  | 'strategist'
  | 'support';

export type AgentAvatarMood = 'calm' | 'focused' | 'energetic' | 'guarded';
export type AgentAvatarTone = 'slate' | 'teal' | 'blue' | 'amber' | 'rose' | 'emerald' | 'violet';
export type AgentAvatarProfileSource = 'semantic' | 'fallback';

export interface AgentAvatarSemanticInput {
  id: string;
  name: string;
  category?: string;
  headline?: string;
  summary?: string;
  role?: string;
  tags?: string[];
  sourceText?: string;
  seedHint?: string;
  source: 'local' | 'market';
}

export interface AgentAvatarProfile {
  seed: string;
  archetype: AgentAvatarArchetype;
  mood: AgentAvatarMood;
  tone: AgentAvatarTone;
  source: AgentAvatarProfileSource;
}

const ARCHETYPES: AgentAvatarArchetype[] = [
  'builder',
  'analyst',
  'operator',
  'guardian',
  'researcher',
  'communicator',
  'creative',
  'strategist',
  'support',
];

const CATEGORY_WEIGHTS: Record<string, Array<[AgentAvatarArchetype, number]>> = {
  management: [['strategist', 6], ['operator', 2]],
  productivity: [['operator', 5], ['support', 2]],
  development: [['builder', 6], ['analyst', 1]],
  business: [['communicator', 5], ['strategist', 2]],
  creative: [['creative', 6], ['communicator', 1]],
  data: [['analyst', 6], ['researcher', 1]],
  marketing: [['communicator', 4], ['creative', 3]],
  education: [['researcher', 4], ['support', 3]],
  security: [['guardian', 6], ['analyst', 1]],
  saas: [['strategist', 4], ['analyst', 2]],
  automation: [['operator', 5], ['support', 2]],
};

const KEYWORDS: Record<AgentAvatarArchetype, string[]> = {
  builder: [
    'build',
    'builder',
    'code',
    'coding',
    'developer',
    'engineering',
    'api',
    'schema',
    'migration',
    'bug',
    'deploy',
    '开发',
    '编码',
    '工程',
    '接口',
    '数据库',
    '架构',
    '构建',
    '修复',
    '测试',
  ],
  analyst: [
    'analyze',
    'analysis',
    'analytics',
    'data',
    'sql',
    'report',
    'dashboard',
    'metrics',
    'insight',
    'audit',
    '分析',
    '数据',
    '报表',
    '仪表盘',
    '指标',
    '洞察',
    '审计',
  ],
  operator: [
    'ops',
    'operation',
    'orchestration',
    'orchestrator',
    'workflow',
    'automation',
    'cron',
    'runtime',
    'sync',
    'monitor',
    '运营',
    '调度',
    '工作流',
    '自动化',
    '运行',
    '同步',
    '监控',
  ],
  guardian: [
    'security',
    'threat',
    'vuln',
    'vulnerability',
    'hardener',
    'hardening',
    'phishing',
    'access',
    'risk',
    'compliance',
    '安全',
    '威胁',
    '漏洞',
    '钓鱼',
    '权限',
    '风险',
    '加固',
  ],
  researcher: [
    'research',
    'study',
    'learning',
    'investigate',
    'discovery',
    'academic',
    'explore',
    'researcher',
    '研究',
    '调研',
    '学习',
    '探索',
  ],
  communicator: [
    'meeting',
    'support',
    'customer',
    'sales',
    'lead',
    'outreach',
    'brand',
    'seo',
    'content',
    'briefing',
    'schedule',
    'calendar',
    '沟通',
    '会议',
    '客服',
    '销售',
    '线索',
    '外联',
    '品牌',
    '内容',
    '简报',
  ],
  creative: [
    'design',
    'designer',
    'thumbnail',
    'banner',
    'video',
    'script',
    'copywriter',
    'ux',
    'creative',
    'proofread',
    '设计',
    '缩略图',
    '横幅',
    '视频',
    '脚本',
    '文案',
    '创意',
    '校对',
  ],
  strategist: [
    'product',
    'strategy',
    'roadmap',
    'pricing',
    'feature',
    'scrum',
    'manager',
    'planner',
    'planning',
    'productivity',
    '产品',
    '策略',
    '路线图',
    '定价',
    '需求',
    '规划',
    '管理',
  ],
  support: [
    'assistant',
    'helper',
    'coach',
    'tutor',
    'scheduler',
    'guide',
    'organizer',
    'companion',
    '助理',
    '助手',
    '导师',
    '教练',
    '安排',
    '引导',
    '陪伴',
  ],
};

const ARCHETYPE_DEFAULTS: Record<AgentAvatarArchetype, { mood: AgentAvatarMood; tone: AgentAvatarTone }> = {
  builder: { mood: 'focused', tone: 'teal' },
  analyst: { mood: 'focused', tone: 'blue' },
  operator: { mood: 'calm', tone: 'slate' },
  guardian: { mood: 'guarded', tone: 'emerald' },
  researcher: { mood: 'calm', tone: 'violet' },
  communicator: { mood: 'energetic', tone: 'amber' },
  creative: { mood: 'energetic', tone: 'rose' },
  strategist: { mood: 'calm', tone: 'slate' },
  support: { mood: 'calm', tone: 'blue' },
};

const MOOD_ROTATION: AgentAvatarMood[] = ['calm', 'focused', 'energetic', 'guarded'];
const TONE_ROTATION: AgentAvatarTone[] = ['slate', 'teal', 'blue', 'amber', 'rose', 'emerald', 'violet'];

export function buildAgentAvatarProfile(input: AgentAvatarSemanticInput): AgentAvatarProfile {
  const scores = new Map<AgentAvatarArchetype, number>(ARCHETYPES.map((entry) => [entry, 0]));
  applyCategoryWeights(scores, input.category);
  applyWeightedText(scores, input.name, 1);
  applyWeightedText(scores, input.id, 1);
  applyWeightedText(scores, input.role, 4);
  applyWeightedText(scores, input.headline, 3);
  applyWeightedText(scores, input.summary, 3);
  applyWeightedTags(scores, input.tags, 2);
  applyWeightedText(scores, input.sourceText, 2);

  const normalizedSeed = normalizeSeed(input.seedHint || input.id || input.name || 'agent');
  const best = resolveTopArchetype(scores, normalizedSeed);
  const source = best.score > 0 ? 'semantic' : 'fallback';
  const defaults = ARCHETYPE_DEFAULTS[best.archetype];
  const mood = source === 'semantic'
    ? defaults.mood
    : MOOD_ROTATION[stableHash(`${normalizedSeed}:mood`) % MOOD_ROTATION.length];
  const tone = source === 'semantic'
    ? defaults.tone
    : TONE_ROTATION[stableHash(`${normalizedSeed}:tone`) % TONE_ROTATION.length];

  return {
    seed: normalizedSeed,
    archetype: best.archetype,
    mood,
    tone,
    source,
  };
}

export function normalizeSemanticText(value: string | undefined): string {
  return (value || '')
    .toLowerCase()
    .replace(/[`*_>#]/g, ' ')
    .replace(/[^\p{L}\p{N}\s-]+/gu, ' ')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeSeed(value: string): string {
  const normalized = normalizeSemanticText(value).replace(/\s+/g, '-');
  return normalized || 'agent';
}

export function stableHash(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function applyCategoryWeights(scores: Map<AgentAvatarArchetype, number>, category: string | undefined): void {
  const normalized = normalizeSemanticText(category);
  if (!normalized) return;
  const weights = CATEGORY_WEIGHTS[normalized];
  if (!weights) return;
  weights.forEach(([archetype, weight]) => {
    scores.set(archetype, (scores.get(archetype) || 0) + weight);
  });
}

function applyWeightedText(
  scores: Map<AgentAvatarArchetype, number>,
  value: string | undefined,
  baseWeight: number,
): void {
  const normalized = normalizeSemanticText(value);
  if (!normalized) return;
  for (const archetype of ARCHETYPES) {
    const keywords = KEYWORDS[archetype];
    const keywordHits = keywords.reduce((count, keyword) => (
      normalized.includes(keyword) ? count + 1 : count
    ), 0);
    if (keywordHits > 0) {
      scores.set(archetype, (scores.get(archetype) || 0) + keywordHits * baseWeight);
    }
  }
}

function applyWeightedTags(
  scores: Map<AgentAvatarArchetype, number>,
  tags: string[] | undefined,
  baseWeight: number,
): void {
  if (!Array.isArray(tags) || tags.length === 0) return;
  applyWeightedText(scores, tags.join(' '), baseWeight);
}

function resolveTopArchetype(
  scores: Map<AgentAvatarArchetype, number>,
  seed: string,
): { archetype: AgentAvatarArchetype; score: number } {
  let topScore = Number.NEGATIVE_INFINITY;
  let top: AgentAvatarArchetype[] = [];

  for (const archetype of ARCHETYPES) {
    const score = scores.get(archetype) || 0;
    if (score > topScore) {
      topScore = score;
      top = [archetype];
      continue;
    }
    if (score === topScore) {
      top.push(archetype);
    }
  }

  if (top.length === 0) {
    const fallback = ARCHETYPES[stableHash(seed) % ARCHETYPES.length];
    return { archetype: fallback, score: 0 };
  }

  if (top.length === 1) {
    return { archetype: top[0], score: topScore };
  }

  const resolved = top[stableHash(`${seed}:archetype`) % top.length];
  return { archetype: resolved, score: topScore };
}
