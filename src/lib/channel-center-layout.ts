export const CHANNEL_CENTER_LAYOUT_MODES = {
  board: 'board',
  focus: 'focus',
  workbench: 'workbench',
} as const;

export type ChannelCenterLayoutMode =
  (typeof CHANNEL_CENTER_LAYOUT_MODES)[keyof typeof CHANNEL_CENTER_LAYOUT_MODES];

export const CHANNEL_CENTER_BOARD_CARD_MIN_WIDTH = 264;

export const CHANNEL_CENTER_BOARD_COLUMN_BREAKPOINTS = {
  twoColumns: 640,
  threeColumns: 960,
  fourColumns: 1320,
} as const;

export const CHANNEL_CENTER_WORKBENCH_MIN_WIDTH = 1600;

export const getChannelBoardColumnCount = (containerWidth: number): 1 | 2 | 3 | 4 =>
  containerWidth >= CHANNEL_CENTER_BOARD_COLUMN_BREAKPOINTS.fourColumns
    ? 4
    : containerWidth >= CHANNEL_CENTER_BOARD_COLUMN_BREAKPOINTS.threeColumns
      ? 3
      : containerWidth >= CHANNEL_CENTER_BOARD_COLUMN_BREAKPOINTS.twoColumns
        ? 2
        : 1;

export const getChannelCenterLayoutMode = (
  containerWidth: number,
  hasSelectedContext: boolean,
): ChannelCenterLayoutMode =>
  hasSelectedContext && containerWidth >= CHANNEL_CENTER_WORKBENCH_MIN_WIDTH
    ? CHANNEL_CENTER_LAYOUT_MODES.workbench
    : hasSelectedContext
      ? CHANNEL_CENTER_LAYOUT_MODES.focus
      : CHANNEL_CENTER_LAYOUT_MODES.board;
