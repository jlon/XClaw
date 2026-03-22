export const CHANNEL_CENTER_LAYOUT_MODES = {
  board: 'board',
  focus: 'focus',
  workbench: 'workbench',
} as const;

export type ChannelCenterLayoutMode =
  (typeof CHANNEL_CENTER_LAYOUT_MODES)[keyof typeof CHANNEL_CENTER_LAYOUT_MODES];

export const CHANNEL_CENTER_BOARD_COLUMNS = [1, 2, 3, 4] as const;

export type ChannelCenterBoardColumnCount = (typeof CHANNEL_CENTER_BOARD_COLUMNS)[number];

export const CHANNEL_CENTER_BOARD_CARD_MIN_WIDTH = 264;

export const CHANNEL_CENTER_BOARD_COLUMN_BREAKPOINTS = {
  1: 0,
  2: 640,
  3: 960,
  4: 1320,
} as const satisfies Record<ChannelCenterBoardColumnCount, number>;

export const CHANNEL_CENTER_WORKBENCH_MIN_WIDTH = 1600;

const CHANNEL_CENTER_BOARD_COLUMNS_DESC = [...CHANNEL_CENTER_BOARD_COLUMNS].sort((left, right) => right - left);

export const getChannelBoardColumnCount = (containerWidth: number): ChannelCenterBoardColumnCount =>
  CHANNEL_CENTER_BOARD_COLUMNS_DESC.find((columnCount) => containerWidth >= CHANNEL_CENTER_BOARD_COLUMN_BREAKPOINTS[columnCount]) ?? 1;

export const getChannelCenterLayoutMode = (
  containerWidth: number,
  hasSelectedContext: boolean,
): ChannelCenterLayoutMode =>
  hasSelectedContext && containerWidth >= CHANNEL_CENTER_WORKBENCH_MIN_WIDTH
    ? CHANNEL_CENTER_LAYOUT_MODES.workbench
    : hasSelectedContext
      ? CHANNEL_CENTER_LAYOUT_MODES.focus
      : CHANNEL_CENTER_LAYOUT_MODES.board;
