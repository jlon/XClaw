import { describe, expect, it } from 'vitest';
import {
  CHANNEL_CENTER_BOARD_CARD_MIN_WIDTH,
  CHANNEL_CENTER_BOARD_COLUMN_BREAKPOINTS,
  CHANNEL_CENTER_LAYOUT_MODES,
  CHANNEL_CENTER_WORKBENCH_MIN_WIDTH,
  getChannelBoardColumnCount,
  getChannelCenterLayoutMode,
} from '@/lib/channel-center-layout';

describe('channel center layout', () => {
  it('exports the documented layout constants', () => {
    expect(CHANNEL_CENTER_LAYOUT_MODES).toEqual({
      board: 'board',
      focus: 'focus',
      workbench: 'workbench',
    });
    expect(CHANNEL_CENTER_BOARD_CARD_MIN_WIDTH).toBe(264);
    expect(CHANNEL_CENTER_BOARD_COLUMN_BREAKPOINTS).toEqual({
      twoColumns: 640,
      threeColumns: 960,
      fourColumns: 1320,
    });
    expect(CHANNEL_CENTER_WORKBENCH_MIN_WIDTH).toBe(1600);
  });

  it('maps board widths to 1 / 2 / 3 / 4 columns at the documented breakpoints', () => {
    expect(getChannelBoardColumnCount(639)).toBe(1);
    expect(getChannelBoardColumnCount(640)).toBe(2);
    expect(getChannelBoardColumnCount(959)).toBe(2);
    expect(getChannelBoardColumnCount(960)).toBe(3);
    expect(getChannelBoardColumnCount(1319)).toBe(3);
    expect(getChannelBoardColumnCount(1320)).toBe(4);
  });

  it('stays on board mode when nothing is selected, even at ultra-wide widths', () => {
    expect(getChannelCenterLayoutMode(2400, false)).toBe('board');
  });

  it('enters workbench only when selected context reaches the workbench threshold', () => {
    expect(getChannelCenterLayoutMode(1599, true)).toBe('focus');
    expect(getChannelCenterLayoutMode(1600, true)).toBe('workbench');
  });

  it('prefers focus when a wide workbench shrinks below the workbench threshold', () => {
    expect(getChannelCenterLayoutMode(2000, true)).toBe('workbench');
    expect(getChannelCenterLayoutMode(1500, true)).toBe('focus');
  });
});
