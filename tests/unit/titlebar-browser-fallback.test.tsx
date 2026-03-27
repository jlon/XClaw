import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TitleBar } from '@/components/layout/TitleBar';

const invokeIpcMock = vi.fn();

vi.mock('@/lib/api-client', () => ({
  invokeIpc: (...args: unknown[]) => invokeIpcMock(...args),
}));

vi.mock('@/pages/Chat/ChatToolbar', () => ({
  ChatToolbar: () => <div data-testid="chat-toolbar" />,
}));

vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => {} },
  useTranslation: () => ({
    t: (key: string) => {
      switch (key) {
        case 'toolbar.office':
          return 'Studio';
        case 'toolbar.backToChat':
          return 'Chat';
        case 'toolbar.switchToLight':
          return 'Switch to light';
        case 'toolbar.switchToDark':
          return 'Switch to dark';
        case 'composer.gatewayConnectedHint':
          return 'Gateway connected';
        default:
          return key;
      }
    },
  }),
}));

describe('titlebar browser fallback', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('avoids desktop window controls when Electron is unavailable', async () => {
    const previousElectron = window.electron;
    // @ts-expect-error test explicitly simulates browser-only runtime
    window.electron = undefined;

    try {
      render(
        <MemoryRouter initialEntries={['/setup']}>
          <TitleBar />
        </MemoryRouter>,
      );

      expect(screen.queryByTitle('Minimize')).not.toBeInTheDocument();
      expect(screen.queryByTitle('Maximize')).not.toBeInTheDocument();
      expect(screen.queryByTitle('Close')).not.toBeInTheDocument();
      expect(invokeIpcMock).not.toHaveBeenCalled();
    } finally {
      window.electron = previousElectron;
    }
  }, 15000);

  it('keeps the browser studio toggle icon-only while preserving the accessible label', () => {
    const previousElectron = window.electron;
    // @ts-expect-error test explicitly simulates browser-only runtime
    window.electron = undefined;

    try {
      render(
        <MemoryRouter initialEntries={['/studio']}>
          <TitleBar />
        </MemoryRouter>,
      );

      const chatButton = screen.getByRole('button', { name: 'Chat' });
      expect(chatButton).toBeInTheDocument();
      expect(chatButton).not.toHaveTextContent('Chat');
    } finally {
      window.electron = previousElectron;
    }
  });
});
