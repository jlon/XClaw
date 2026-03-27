import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { UpdateSettings } from '@/components/settings/UpdateSettings';

const { invokeIpcMock, updateState, settingsState } = vi.hoisted(() => ({
  invokeIpcMock: vi.fn(),
  updateState: {
    status: 'available',
    currentVersion: '2026.3.23',
    updateInfo: {
      version: '2026.3.26-beta.0',
      releaseDate: '2026-03-26T08:00:00.000Z',
      releaseNotes: '修复更新通道和下载流程',
      downloadUrl: 'https://www.xclaw.live/downloads/updates/beta/XClaw-2026.3.26-beta.0-mac-arm64.dmg',
    },
    progress: null,
    error: null,
    isInitialized: true,
    autoInstallCountdown: null,
    init: vi.fn(),
    checkForUpdates: vi.fn(),
    downloadUpdate: vi.fn(),
    installUpdate: vi.fn(),
    cancelAutoInstall: vi.fn(),
    setChannel: vi.fn(),
    setAutoDownload: vi.fn(),
    clearError: vi.fn(),
  },
  settingsState: {
    updateChannel: 'beta',
    autoCheckUpdate: true,
    autoDownloadUpdate: false,
    setUpdateChannel: vi.fn(),
    setAutoCheckUpdate: vi.fn(),
    setAutoDownloadUpdate: vi.fn(),
  },
}));

vi.mock('@/stores/update', () => ({
  useUpdateStore: (selector?: (state: typeof updateState) => unknown) => (
    selector ? selector(updateState) : updateState
  ),
}));

vi.mock('@/stores/settings', () => ({
  useSettingsStore: (selector?: (state: typeof settingsState) => unknown) => (
    selector ? selector(settingsState) : settingsState
  ),
}));

vi.mock('@/lib/api-client', () => ({
  invokeIpc: (...args: unknown[]) => invokeIpcMock(...args),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, arg?: Record<string, unknown>) => {
      if (key === 'updates.currentVersion') return '当前版本';
      if (key === 'updates.latestVersion') return '最新版本';
      if (key === 'updates.autoCheck') return '自动检查更新';
      if (key === 'updates.autoCheckDesc') return '启动时自动检查新版本';
      if (key === 'updates.channel') return '更新通道';
      if (key === 'updates.actions.check') return '检查更新';
      if (key === 'updates.actions.downloadLatest') return '下载最新版本';
      if (key === 'updates.actions.install') return '重启并安装';
      if (key === 'updates.channels.beta') return 'Beta';
      if (key === 'updates.manualDownloadTitle') return '手动更新';
      if (key === 'updates.manualDownloadDesc') return 'mac 当前仅支持手动下载安装 Beta 包。';
      if (key === 'updates.status.available') return '发现新版本';
      if (key === 'updates.detail.available') return '检测到更高版本，可以立即下载并在下载完成后安装。';
      if (key === 'updates.releaseVersion' && typeof arg?.version === 'string') {
        return `版本 ${arg.version}`;
      }
      if (key === 'common:status.loading') return '加载中';
      return key;
    },
  }),
}));

describe('UpdateSettings', () => {
  beforeEach(() => {
    window.electron.platform = 'darwin';
    updateState.init.mockClear();
  });

  it('renders macOS manual-update controls instead of fake auto-update actions', () => {
    render(<UpdateSettings />);

    expect(screen.getByText('发现新版本')).toBeInTheDocument();
    expect(screen.getByText('当前版本')).toBeInTheDocument();
    expect(screen.getByText('最新版本')).toBeInTheDocument();
    expect(screen.getByText('自动检查更新')).toBeInTheDocument();
    expect(screen.getByText('更新通道')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
    expect(screen.getByText('手动更新')).toBeInTheDocument();
    expect(screen.getByText('版本 2026.3.26-beta.0')).toBeInTheDocument();
    expect(screen.getAllByText('mac 当前仅支持手动下载安装 Beta 包。')).toHaveLength(2);
    expect(screen.getByRole('button', { name: '检查更新' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '下载最新版本' })).toBeInTheDocument();
    expect(screen.queryByText('自动下载更新')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '重启并安装' })).not.toBeInTheDocument();
    expect(screen.queryByText('自动更新已禁用')).not.toBeInTheDocument();
    expect(screen.queryByText('检测到更高版本，可以立即下载并在下载完成后安装。')).not.toBeInTheDocument();
  });
});
