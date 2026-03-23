export interface AgentAvatarPalette {
  background: string;
  foreground: string;
  accent: string;
  border: string;
}

export interface AgentAvatarSpec {
  seed: number;
  palette: AgentAvatarPalette;
  cells: boolean[][];
}

const AVATAR_GRID_SIZE = 5;
const MIRROR_COLUMNS = 3;

function hashSeed(seed: string) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function unitValue(seed: string, offset: number) {
  const hash = hashSeed(`${seed}:${offset}`);
  return (hash % 1000) / 1000;
}

function buildCells(seed: string) {
  return Array.from({ length: AVATAR_GRID_SIZE }, (_, row) =>
    Array.from({ length: AVATAR_GRID_SIZE }, (_, column) => {
      const mirroredColumn = column < MIRROR_COLUMNS ? column : AVATAR_GRID_SIZE - column - 1;
      return unitValue(seed, row * MIRROR_COLUMNS + mirroredColumn) > 0.44;
    }),
  );
}

export function getAgentAvatarTheme(seed: string) {
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

export function buildAgentAvatarSpec(seed: string): AgentAvatarSpec {
  const theme = getAgentAvatarTheme(seed);

  return {
    seed: hashSeed(seed.trim() || 'agent'),
    palette: {
      background: theme.background,
      foreground: theme.primary,
      accent: theme.secondary,
      border: theme.surface,
    },
    cells: theme.cells,
  };
}
