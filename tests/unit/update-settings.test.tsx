import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { UpdateSettings } from '@/components/settings/UpdateSettings';

const { updateState } = vi.hoisted(() => ({
  updateState: {
    status: 'unsupported',
    currentVersion: '0.2.5',
    updateInfo: null,
    progress: null,
    error: 'Update checks are only available in packaged builds.',
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
      if (key === 'updates.status.packagedOnly') return '开发环境下不检查更新';
      if (key === 'updates.action.packagedOnly') return '仅打包版可用';
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

  it('renders a neutral packaged-build-only state in dev mode instead of an error panel', () => {
    render(<UpdateSettings />);

    expect(screen.getByText('开发环境下不检查更新')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '仅打包版可用' })).toBeDisabled();
    expect(screen.queryByText('错误详情：')).not.toBeInTheDocument();
  });
});
