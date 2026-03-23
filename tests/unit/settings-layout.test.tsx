import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Settings } from '@/pages/Settings/index';

const {
  settingsState,
  gatewayState,
  updateState,
  invokeIpcMock,
  hostApiFetchMock,
} = vi.hoisted(() => ({
  settingsState: {
    theme: 'system',
    setTheme: vi.fn(),
    language: 'zh-CN',
    setLanguage: vi.fn(),
    launchAtStartup: false,
    setLaunchAtStartup: vi.fn(),
    gatewayAutoStart: true,
    setGatewayAutoStart: vi.fn(),
    proxyEnabled: false,
    proxyServer: '',
    proxyHttpServer: '',
    proxyHttpsServer: '',
    proxyAllServer: '',
    proxyBypassRules: '',
    setProxyEnabled: vi.fn(),
    setProxyServer: vi.fn(),
    setProxyHttpServer: vi.fn(),
    setProxyHttpsServer: vi.fn(),
    setProxyAllServer: vi.fn(),
    setProxyBypassRules: vi.fn(),
    autoCheckUpdate: true,
    setAutoCheckUpdate: vi.fn(),
    autoDownloadUpdate: false,
    setAutoDownloadUpdate: vi.fn(),
    devModeUnlocked: true,
    setDevModeUnlocked: vi.fn(),
    telemetryEnabled: true,
    setTelemetryEnabled: vi.fn(),
  },
  gatewayState: {
    status: { state: 'running', port: 18789 },
    restart: vi.fn(),
  },
  updateState: {
    setAutoDownload: vi.fn(),
  },
  invokeIpcMock: vi.fn(),
  hostApiFetchMock: vi.fn(),
}));

vi.mock('@/stores/settings', () => ({
  useSettingsStore: (selector?: (state: typeof settingsState) => unknown) => (
    selector ? selector(settingsState) : settingsState
  ),
}));

vi.mock('@/stores/gateway', () => ({
  useGatewayStore: (selector?: (state: typeof gatewayState) => unknown) => (
    selector ? selector(gatewayState) : gatewayState
  ),
}));

vi.mock('@/stores/update', () => ({
  useUpdateStore: (selector?: (state: typeof updateState) => unknown) => (
    selector ? selector(updateState) : updateState
  ),
}));

vi.mock('@/components/settings/UpdateSettings', () => ({
  UpdateSettings: () => <div>更新面板</div>,
}));

vi.mock('@/components/layout/WorkbenchSummaryStrip', () => ({
  WorkbenchSummaryStrip: ({ items }: { items: Array<{ label: string; value: string | number }> }) => (
    <div>{items.map((item) => `${item.label}:${item.value}`).join(' | ')}</div>
  ),
}));

vi.mock('@/lib/host-api', () => ({
  hostApiFetch: (...args: unknown[]) => hostApiFetchMock(...args),
}));

vi.mock('@/lib/api-client', () => ({
  getGatewayWsDiagnosticEnabled: vi.fn(() => false),
  invokeIpc: (...args: unknown[]) => invokeIpcMock(...args),
  setGatewayWsDiagnosticEnabled: vi.fn(),
  toUserMessage: (error: unknown) => String(error),
}));

vi.mock('@/lib/telemetry', () => ({
  clearUiTelemetry: vi.fn(),
  getUiTelemetrySnapshot: vi.fn(() => []),
  subscribeUiTelemetry: vi.fn(() => () => {}),
  trackUiEvent: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => {} },
  useTranslation: () => ({
    t: (key: string, arg?: Record<string, unknown>) => {
      if (key === 'title') return '设置';
      if (key === 'subtitle') return '配置您的 XClaw 体验';
      if (key === 'appearance.title') return '通用';
      if (key === 'appearance.description') return '自定义外观和风格';
      if (key === 'appearance.theme') return '主题';
      if (key === 'appearance.light') return '浅色';
      if (key === 'appearance.dark') return '深色';
      if (key === 'appearance.system') return '跟随系统';
      if (key === 'appearance.language') return '语言';
      if (key === 'appearance.launchAtStartup') return '开机自动启动';
      if (key === 'appearance.launchAtStartupDesc') return '登录系统后自动启动 XClaw';
      if (key === 'gateway.title') return '网关';
      if (key === 'gateway.description') return 'OpenClaw 网关设置';
      if (key === 'gateway.status') return '状态';
      if (key === 'gateway.port') return '端口';
      if (key === 'gateway.autoStart') return '自动启动网关';
      if (key === 'updates.title') return '更新';
      if (key === 'updates.description') return '保持 XClaw 最新';
      if (key === 'updates.autoCheck') return '自动检查更新';
      if (key === 'updates.autoCheckDesc') return '启动时检查更新';
      if (key === 'updates.autoDownload') return '自动更新';
      if (key === 'updates.autoDownloadDesc') return '自动下载并安装更新';
      if (key === 'developer.title') return '开发者';
      if (key === 'developer.description') return '开发者高级选项';
      if (key === 'advanced.telemetry') return '匿名使用数据';
      if (key === 'advanced.telemetryDesc') return '允许提供匿名的基础使用数据，用于改进 XClaw';
      if (key === 'advanced.devMode') return '开发者模式';
      if (key === 'advanced.devModeDesc') return '显示开发者工具和快捷方式';
      if (key === 'common:status.running') return '运行中';
      if (key === 'common:status.enabled') return '已启用';
      if (key === 'common:status.disabled') return '已禁用';
      if (key === 'common:actions.restart') return '重启';
      if (key === 'common:actions.save') return '保存';
      if (key === 'common:status.saving') return '保存中';
      if (key === 'common:actions.load') return '加载';
      if (key === 'common:actions.copy') return '复制';
      if (key === 'common:actions.show') return '显示';
      if (key === 'common:actions.hide') return '隐藏';
      if (key === 'gateway.logs') return '日志';
      if (key === 'gateway.exportLogs') return '导出日志包';
      if (key === 'gateway.logsExporting') return '导出中...';
      if (key === 'gateway.logsExported') return `已导出 ${arg?.count ?? 0} 份日志文件`;
      if (key === 'gateway.logsExportFailed') return '导出日志包失败';
      if (key === 'gateway.openFolder') return '打开文件夹';
      if (key === 'gateway.proxyTitle') return '代理';
      if (key === 'gateway.proxyDesc') return '让 Electron 和 Gateway 的网络请求都走本地代理客户端。';
      if (key === 'gateway.proxyServer') return '代理服务器';
      if (key === 'gateway.showAdvancedProxy') return '显示高级代理字段';
      if (key === 'gateway.hideAdvancedProxy') return '隐藏高级代理字段';
      if (key === 'gateway.proxyServerHelp') return '所有请求默认使用的代理。';
      if (key === 'developer.console') return 'OpenClaw 控制台';
      if (key === 'developer.consoleDesc') return '访问原生 OpenClaw 管理界面';
      if (key === 'developer.gatewayToken') return '网关令牌';
      if (key === 'developer.gatewayTokenDesc') return '如果需要，将此粘贴到控制台设置中';
      if (key === 'developer.tokenUnavailable') return '令牌不可用';
      if (key === 'developer.openConsole') return '打开开发者控制台';
      if (key === 'developer.cli') return 'OpenClaw CLI';
      if (key === 'developer.cliDesc') return '复制命令以运行 OpenClaw，无需修改 PATH。';
      if (key === 'developer.cmdUnavailable') return '命令不可用';
      if (key === 'developer.doctor') return 'OpenClaw Doctor 诊断';
      if (key === 'developer.doctorDesc') return '运行 doctor';
      if (key === 'developer.runDoctor') return '运行 Doctor';
      if (key === 'developer.runDoctorFix') return '运行 Doctor 并修复';
      if (key === 'developer.wsDiagnostic') return 'WS 诊断模式';
      if (key === 'developer.wsDiagnosticDesc') return '临时启用 WS/HTTP 回退链';
      if (key === 'developer.telemetryViewer') return '埋点查看器';
      if (key === 'developer.telemetryViewerDesc') return '仅本地 UX/性能埋点';
      if (key === 'chat:noLogs') return '暂无日志';
      if (arg && typeof arg.version === 'string') return `版本 ${arg.version}`;
      return key;
    },
  }),
}));

describe('settings layout', () => {
  beforeEach(() => {
    window.electron.platform = 'darwin';
    invokeIpcMock.mockReset();
    invokeIpcMock.mockResolvedValue(undefined);
    hostApiFetchMock.mockReset();
    hostApiFetchMock.mockResolvedValue({});
  });

  it('uses top tabs and shows only one active settings pane at a time', async () => {
    render(<Settings />);

    expect(screen.getByRole('tab', { name: '通用' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '网关' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '更新' })).toBeInTheDocument();

    expect(screen.getByText('主题')).toBeInTheDocument();
    expect(screen.queryByText('代理')).not.toBeInTheDocument();

    const runtimeTab = screen.getByRole('tab', { name: '网关' });
    fireEvent.mouseDown(runtimeTab, { button: 0, ctrlKey: false });
    fireEvent.click(runtimeTab);

    await waitFor(() => {
      expect(screen.getByText('代理')).toBeInTheDocument();
      expect(screen.queryByText('主题')).not.toBeInTheDocument();
    });
  });

  it('removes auto-update toggles from the updates pane when built-in updater is disabled', async () => {
    render(<Settings />);

    const updatesTab = screen.getByRole('tab', { name: '更新' });
    fireEvent.mouseDown(updatesTab, { button: 0, ctrlKey: false });
    fireEvent.click(updatesTab);

    await waitFor(() => {
      expect(screen.getByText('更新面板')).toBeInTheDocument();
    });

    expect(screen.queryByText('自动检查更新')).not.toBeInTheDocument();
    expect(screen.queryByText('自动更新')).not.toBeInTheDocument();
  });

  it('exports a platform log bundle from the runtime pane', async () => {
    hostApiFetchMock.mockImplementation(async (path: string) => {
      if (path === '/api/logs/export') {
        return { success: true, fileCount: 3, savedPath: '/tmp/xclaw-logs.zip' };
      }
      return {};
    });

    render(<Settings />);

    const runtimeTab = screen.getByRole('tab', { name: '网关' });
    fireEvent.mouseDown(runtimeTab, { button: 0, ctrlKey: false });
    fireEvent.click(runtimeTab);

    const exportButton = await screen.findByRole('button', { name: '导出日志包' });
    fireEvent.click(exportButton);

    await waitFor(() => {
      expect(hostApiFetchMock).toHaveBeenCalledWith('/api/logs/export', expect.objectContaining({
        method: 'POST',
      }));
    });
  });
});
