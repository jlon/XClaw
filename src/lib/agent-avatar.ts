import { createAvatar } from '@dicebear/core';
import { micah } from '@dicebear/collection';
import type { AgentAvatarMood, AgentAvatarProfile, AgentAvatarTone } from '../../shared/agent-avatar-persona';
import { stableHash } from '../../shared/agent-avatar-persona';

export interface AgentAvatarFrame {
  background: string;
  border: string;
}

export interface AgentAvatarSpec {
  kind: 'semantic' | 'fallback';
  dataUri: string;
  frame: AgentAvatarFrame;
}

interface LegacyAvatarTheme {
  background: string;
  surface: string;
  primary: string;
  secondary: string;
  cells: boolean[][];
}

const AVATAR_GRID_SIZE = 5;
const MIRROR_COLUMNS = 3;
type MicahEye = 'eyes' | 'round' | 'eyesShadow' | 'smiling' | 'smilingShadow';
type MicahMouth =
  | 'surprised'
  | 'laughing'
  | 'nervous'
  | 'smile'
  | 'sad'
  | 'pucker'
  | 'frown'
  | 'smirk';

const TONE_MAP: Record<AgentAvatarTone, { background: string; border: string; dicebear: string[] }> = {
  slate: { background: 'hsl(216 18% 95%)', border: 'hsl(216 16% 88%)', dicebear: ['e6edf5', 'd9e2ec'] },
  teal: { background: 'hsl(180 26% 95%)', border: 'hsl(180 20% 87%)', dicebear: ['dcf4f1', 'cdeceb'] },
  blue: { background: 'hsl(212 28% 95%)', border: 'hsl(212 20% 87%)', dicebear: ['dde9fb', 'd0def6'] },
  amber: { background: 'hsl(36 42% 95%)', border: 'hsl(36 24% 86%)', dicebear: ['faecd8', 'f7e1c1'] },
  rose: { background: 'hsl(348 34% 95%)', border: 'hsl(348 22% 87%)', dicebear: ['f7dfe8', 'f2d0db'] },
  emerald: { background: 'hsl(156 28% 95%)', border: 'hsl(156 18% 86%)', dicebear: ['dcf3e8', 'cceadf'] },
  violet: { background: 'hsl(262 28% 95%)', border: 'hsl(262 18% 87%)', dicebear: ['ece2f9', 'dfd1f2'] },
};

const MOOD_OPTIONS: Record<AgentAvatarMood, { eyes: MicahEye[]; mouth: MicahMouth[] }> = {
  calm: {
    eyes: ['round', 'smiling', 'smilingShadow'],
    mouth: ['smile', 'smirk'],
  },
  focused: {
    eyes: ['eyes', 'round', 'eyesShadow'],
    mouth: ['smirk', 'smile', 'pucker'],
  },
  energetic: {
    eyes: ['smiling', 'smilingShadow', 'round'],
    mouth: ['laughing', 'smile', 'surprised'],
  },
  guarded: {
    eyes: ['eyesShadow', 'eyes', 'round'],
    mouth: ['nervous', 'pucker', 'frown'],
  },
};

export function buildAgentAvatarSpec(input: {
  seed: string;
  profile?: AgentAvatarProfile | null;
  locale?: string | null;
}): AgentAvatarSpec {
  if (input.profile?.source === 'semantic') {
    const semantic = buildSemanticAvatar(input.profile, input.locale);
    if (semantic) return semantic;
  }
  return buildFallbackAvatar(input.profile?.seed || input.seed);
}

function isChineseUiLocale(locale: string | undefined | null): boolean {
  if (!locale) {
    return false;
  }
  return locale.toLowerCase().replace(/_/g, '-').startsWith('zh');
}

type MicahHairStyle =
  | 'fonze'
  | 'mrT'
  | 'dougFunny'
  | 'mrClean'
  | 'dannyPhantom'
  | 'full'
  | 'turban'
  | 'pixie';

const MICAH_HAIR_WITH_VISIBLE_HAIR: MicahHairStyle[] = [
  'fonze',
  'mrT',
  'dannyPhantom',
  'full',
  'turban',
  'pixie',
];

function micahOptionsForChineseUi() {
  const hair: MicahHairStyle[] = ['pixie', 'full', 'dannyPhantom', 'fonze', 'mrT'];
  return {
    baseColor: ['f9c9b6', 'ffdfbf', 'fde4d0', 'fad4c4'],
    facialHairProbability: 0,
    hair,
    hairProbability: 100,
  };
}

function micahOptionsNoBaldNonZh() {
  return {
    hair: [...MICAH_HAIR_WITH_VISIBLE_HAIR],
    hairProbability: 100,
  };
}

function buildSemanticAvatar(profile: AgentAvatarProfile, locale?: string | null): AgentAvatarSpec | null {
  try {
    const tone = TONE_MAP[profile.tone];
    const mood = MOOD_OPTIONS[profile.mood];
    const localePresentation = isChineseUiLocale(locale) ? micahOptionsForChineseUi() : micahOptionsNoBaldNonZh();
    const dataUri = createAvatar(micah, {
      seed: `${profile.seed}:${profile.archetype}`,
      backgroundColor: tone.dicebear,
      radius: 20,
      randomizeIds: false,
      eyes: mood.eyes,
      mouth: mood.mouth,
      ...localePresentation,
    }).toDataUri();

    return {
      kind: 'semantic',
      dataUri,
      frame: {
        background: tone.background,
        border: tone.border,
      },
    };
  } catch {
    return null;
  }
}

function buildFallbackAvatar(seed: string): AgentAvatarSpec {
  const theme = getLegacyAvatarTheme(seed);
  const svg = renderLegacyAvatarSvg(theme);

  return {
    kind: 'fallback',
    dataUri: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
    frame: {
      background: theme.background,
      border: theme.surface,
    },
  };
}

function getLegacyAvatarTheme(seed: string): LegacyAvatarTheme {
  const safeSeed = seed.trim() || 'agent';
  const hue = Math.round(200 + unitValue(safeSeed, 24) * 120) % 360;
  const accentHue = (hue + 28 + Math.round(unitValue(safeSeed, 27) * 18)) % 360;
  const background = `hsl(${hue} 20% 96%)`;
  const surface = `hsl(${hue} 18% 91%)`;
  const primary = `hsl(${accentHue} 44% 34%)`;
  const secondary = `hsl(${accentHue} 36% 54%)`;

  return {
    background,
    surface,
    primary,
    secondary,
    cells: buildCells(safeSeed),
  };
}

function renderLegacyAvatarSvg(theme: LegacyAvatarTheme, size = 64): string {
  const padding = Math.max(4, Math.round(size * 0.15));
  const gap = Math.max(1, Math.round(size * 0.045));
  const cellSize = (size - padding * 2 - gap * 4) / 5;
  const rects: string[] = [];

  theme.cells.forEach((row, rowIndex) => {
    row.forEach((tone, columnIndex) => {
      if (!tone) return;
      const x = padding + columnIndex * (cellSize + gap);
      const y = padding + rowIndex * (cellSize + gap);
      rects.push(
        `<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" rx="${Math.max(1.2, cellSize * 0.22)}" fill="${(rowIndex + columnIndex) % 3 === 0 ? theme.secondary : theme.primary}" />`,
      );
    });
  });

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`,
    `<rect x="0" y="0" width="${size}" height="${size}" rx="${size * 0.35}" fill="${theme.background}" />`,
    ...rects,
    '</svg>',
  ].join('');
}

function buildCells(seed: string): boolean[][] {
  return Array.from({ length: AVATAR_GRID_SIZE }, (_, row) =>
    Array.from({ length: AVATAR_GRID_SIZE }, (_, column) => {
      const mirroredColumn = column < MIRROR_COLUMNS ? column : AVATAR_GRID_SIZE - column - 1;
      return unitValue(seed, row * MIRROR_COLUMNS + mirroredColumn) > 0.44;
    }),
  );
}

function unitValue(seed: string, offset: number): number {
  const hash = stableHash(`${seed}:${offset}`);
  return (hash % 1000) / 1000;
}
