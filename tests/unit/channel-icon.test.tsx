import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ChannelIcon } from '@/components/channels/ChannelIcon';

describe('ChannelIcon', () => {
  it('renders the real channel asset instead of a synthetic gradient badge', () => {
    render(<ChannelIcon type="telegram" size={22} />);

    const glyph = screen.getByTestId('channel-icon-glyph-telegram');

    expect(glyph.tagName).toBe('IMG');
    expect(glyph.getAttribute('class')).toContain('object-contain');
  });

  it('renders the native wechat asset directly', () => {
    render(<ChannelIcon type="openclaw-weixin" size={22} />);

    const glyph = screen.getByTestId('channel-icon-glyph-openclaw-weixin');

    expect(glyph.tagName).toBe('IMG');
  });

  it('falls back to a neutral initial badge when a channel has no bundled brand asset', () => {
    render(<ChannelIcon type="signal" size={22} />);

    const glyph = screen.getByTestId('channel-icon-glyph-signal');

    expect(glyph.tagName).toBe('SPAN');
    expect(glyph.textContent).toBe('S');
  });
});
