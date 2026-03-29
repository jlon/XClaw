import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { GlobalTitleBarUtilities } from '@/components/layout/GlobalTitleBarUtilities';

const settingsState = {
  theme: 'light' as const,
  setTheme: vi.fn(),
};

const gatewayState = {
  status: { state: 'running' as const },
};

vi.mock('@/stores/settings', () => ({
  useSettingsStore: (selector: (state: typeof settingsState) => unknown) => selector(settingsState),
}));

vi.mock('@/stores/gateway', () => ({
  useGatewayStore: (selector: (state: typeof gatewayState) => unknown) => selector(gatewayState),
}));

vi.mock('@/pages/Chat/gateway-ui', () => ({
  resolveGatewayUi: () => ({
    labelKey: 'toolbar.gatewayConnected',
    spinning: false,
    toneClass: 'bg-emerald-500',
  }),
}));

vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      if (key === 'toolbar.office') return '工作室';
      if (key === 'toolbar.backToChat') return '聊天';
      if (key === 'toolbar.switchToDark') return '切换到深色主题';
      if (key === 'toolbar.switchToLight') return '切换到浅色主题';
      if (key === 'toolbar.gatewayConnected') return '网关已连接';
      return key;
    },
  }),
}));

describe('global titlebar utilities', () => {
  it('uses a shared wallpaper-aware surface class for utility controls', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/']}>
        <GlobalTitleBarUtilities compact />
      </MemoryRouter>,
    );

    expect(screen.getByRole('button', { name: '工作室' })).toHaveClass('app-titlebar-utility-surface');
    expect(screen.getByRole('button', { name: '切换到深色主题' })).toHaveClass('app-titlebar-utility-surface');
    expect(container.querySelector('.app-chat-runtime-pill')).toHaveClass('app-titlebar-utility-surface');
  });

  it('keeps the theme toggle clickable and wired to the settings store', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <GlobalTitleBarUtilities compact />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: '切换到深色主题' }));

    expect(settingsState.setTheme).toHaveBeenCalledWith('dark');
  });
});
