import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { UpdateSettings } from '@/components/settings/UpdateSettings';

const { updateState } = vi.hoisted(() => ({
  updateState: {
    status: 'disabled',
    currentVersion: '0.2.5',
    updateInfo: null,
    progress: null,
    error: null,
    isInitialized: true,
    autoInstallCountdown: null,
    init: vi.fn(),
    checkForUpdates: vi.fn(),
    downloadUpdate: vi.fn(),
    installUpdate: vi.fn(),
    cancelAutoInstall: vi.fn(),
    clearError: vi.fn(),
  },
}));

vi.mock('@/stores/update', () => ({
  useUpdateStore: (selector?: (state: typeof updateState) => unknown) => (
    selector ? selector(updateState) : updateState
  ),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, arg?: Record<string, unknown>) => {
      if (key === 'updates.status.disabled') return '自动更新已禁用';
      if (key === 'updates.currentVersion') return '当前版本';
      if (key === 'updates.disabledDetail') return '当前构建已禁用内置自动更新，请手动下载新版本。';
      if (key === 'updates.currentVersion') return '当前版本';
      if (key === 'common:status.loading') return '加载中';
      if (key === 'updates.releaseVersion' && typeof arg?.version === 'string') {
        return `版本 ${arg.version}`;
      }
      return key;
    },
  }),
}));

describe('UpdateSettings', () => {
  beforeEach(() => {
    updateState.init.mockClear();
  });

  it('renders a neutral auto-update-disabled state without action buttons or error panels', () => {
    render(<UpdateSettings />);

    expect(screen.getByText('自动更新已禁用')).toBeInTheDocument();
    expect(screen.getByText('当前构建已禁用内置自动更新，请手动下载新版本。')).toBeInTheDocument();
    expect(screen.queryByText('错误详情：')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
