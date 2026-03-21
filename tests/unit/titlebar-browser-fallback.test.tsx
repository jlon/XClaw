import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const invokeIpcMock = vi.fn();

vi.mock('@/lib/api-client', () => ({
  invokeIpc: (...args: unknown[]) => invokeIpcMock(...args),
}));

vi.mock('@/pages/Chat/ChatToolbar', () => ({
  ChatToolbar: () => <div data-testid="chat-toolbar" />,
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
      const { TitleBar } = await import('@/components/layout/TitleBar');

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
  });
});
