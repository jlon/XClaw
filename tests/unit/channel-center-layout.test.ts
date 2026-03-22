import { describe, expect, it } from 'vitest';
import * as layout from '@/lib/channel-center-layout';

describe('channel center layout', () => {
  it('exports the documented layout constants', () => {
    expect(layout.CHANNEL_CENTER_LAYOUT_MODES).toEqual({
      board: 'board',
      focus: 'focus',
      workbench: 'workbench',
    });
    expect(layout.CHANNEL_CENTER_BOARD_COLUMNS).toEqual([1, 2, 3, 4]);
    expect(layout.CHANNEL_CENTER_BOARD_CARD_MIN_WIDTH).toBe(264);
    expect(layout.CHANNEL_CENTER_BOARD_COLUMN_BREAKPOINTS).toEqual({
      1: 0,
      2: 640,
      3: 960,
      4: 1320,
    });
    expect(layout.CHANNEL_CENTER_WORKBENCH_MIN_WIDTH).toBe(1600);
  });

  it('maps board widths to 1 / 2 / 3 / 4 columns at the documented breakpoints', () => {
    expect(layout.getChannelBoardColumnCount(639)).toBe(1);
    expect(layout.getChannelBoardColumnCount(640)).toBe(2);
    expect(layout.getChannelBoardColumnCount(959)).toBe(2);
    expect(layout.getChannelBoardColumnCount(960)).toBe(3);
    expect(layout.getChannelBoardColumnCount(1319)).toBe(3);
    expect(layout.getChannelBoardColumnCount(1320)).toBe(4);
  });

  it('keeps every board breakpoint at or above the minimum readable card width budget', () => {
    const supportedColumns = layout.CHANNEL_CENTER_BOARD_COLUMNS;
    const minimumCardWidth = layout.CHANNEL_CENTER_BOARD_CARD_MIN_WIDTH;
    const breakpoints = layout.CHANNEL_CENTER_BOARD_COLUMN_BREAKPOINTS;

    expect(
      supportedColumns.every((columnCount, index) =>
        index === 0 ? breakpoints[columnCount] === 0 : breakpoints[columnCount] >= columnCount * minimumCardWidth,
      ),
    ).toBe(true);
  });

  it('stays on board mode when nothing is selected, even at ultra-wide widths', () => {
    expect(layout.getChannelCenterLayoutMode(2400, false)).toBe('board');
  });

  it('enters workbench only when selected context reaches the workbench threshold', () => {
    expect(layout.getChannelCenterLayoutMode(1599, true)).toBe('focus');
    expect(layout.getChannelCenterLayoutMode(1600, true)).toBe('workbench');
  });

  it('prefers focus when a wide workbench shrinks below the workbench threshold', () => {
    expect(layout.getChannelCenterLayoutMode(2000, true)).toBe('workbench');
    expect(layout.getChannelCenterLayoutMode(1500, true)).toBe('focus');
  });
});
