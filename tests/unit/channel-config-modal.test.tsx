import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChannelConfigModal } from '@/components/channels/ChannelConfigModal';

const hostApiFetchMock = vi.fn();
const subscribeHostEventMock = vi.fn();
const addChannelMock = vi.fn();
const fetchChannelsMock = vi.fn();

vi.mock('@/lib/host-api', () => ({
  hostApiFetch: (...args: unknown[]) => hostApiFetchMock(...args),
}));

vi.mock('@/lib/host-events', () => ({
  subscribeHostEvent: (...args: unknown[]) => subscribeHostEventMock(...args),
}));

vi.mock('@/stores/channels', () => ({
  useChannelsStore: () => ({
    channels: [],
    addChannel: addChannelMock,
    fetchChannels: fetchChannelsMock,
  }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

describe('ChannelConfigModal theme compatibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses theme-compatible surfaces instead of fixed warm-only fills', () => {
    const { container } = render(
      <ChannelConfigModal
        initialSelectedType="feishu"
        configuredTypes={[]}
        allowExistingConfig={false}
        onClose={() => {}}
      />,
    );

    expect(container.innerHTML).not.toContain('#f3f1e9');
    expect(container.innerHTML).not.toContain('#eeece3');
    expect(container.innerHTML).toContain('bg-card/95');
    expect(container.innerHTML).toContain('bg-background/80');
    expect(container.innerHTML).toContain('dark:bg-background/70');
  });
});
