import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { SetupPreparationStage } from '@/components/setup/SetupPreparationStage';

const { hostApiFetchMock, invokeIpcMock, gatewayState, tMock } = vi.hoisted(() => ({
  hostApiFetchMock: vi.fn(),
  invokeIpcMock: vi.fn(),
  gatewayState: {
    status: { state: 'stopped', port: 18789 },
    start: vi.fn(),
  },
  tMock: (key: string, options?: Record<string, unknown>) => ({
    'runtime.setup.title': 'Fresh runtime settings',
    'runtime.setup.description': 'Confirm workspace and port before setup completes.',
    'runtime.setup.workspaceLabel': 'Workspace',
    'runtime.setup.workspacePlaceholder': '/Users/test/.openclaw/workspace',
    'runtime.setup.workspaceHint': 'Absolute paths are supported.',
    'runtime.setup.portLabel': 'Gateway port',
    'runtime.setup.portHint': 'Use a valid port.',
    'runtime.setup.planChecking': 'Checking the plan...',
    'runtime.title': 'Environment readiness',
    'runtime.nodejs': 'Node.js runtime',
    'runtime.openclaw': 'OpenClaw package',
    'runtime.gateway': 'Gateway service',
    'runtime.startGateway': 'Start gateway',
    'runtime.status.checking': 'Checking...',
    'runtime.status.success': 'Node.js is available',
    'runtime.status.gatewayRunning': `Running on port ${String(options?.port ?? '')}`.trim(),
    'runtime.status.packageReady': 'OpenClaw package ready',
    'runtime.status.packageReadyWithVersion': `OpenClaw package ready v${String(options?.version ?? '')}`.trim(),
    'runtime.status.packageMissingAt': `OpenClaw package not found at ${String(options?.dir ?? '')}`.trim(),
    'runtime.status.packageDistMissing': 'OpenClaw package was found, but the dist build output is missing',
    'runtime.status.checkFailed': `Check failed: ${String(options?.message ?? '')}`.trim(),
    'runtime.status.gatewayWaiting': 'Waiting for gateway...',
    'runtime.status.gatewayStarting': 'Starting gateway...',
    'runtime.status.gatewayStartFailed': 'Failed to start gateway',
    'runtime.status.gatewayStartTimedOut': 'Gateway startup timed out',
    'runtime.summary.description': 'Confirm the runtime summary before continuing.',
    'runtime.summary.ready': 'Ready',
    'runtime.summary.attention': 'Needs attention',
    'runtime.summary.gatewayStopped': 'Gateway stopped',
    'runtime.issue.title': 'Environment issue detected',
    'runtime.issue.desc': 'Resolve the issue before continuing.',
    'runtime.viewLogs': 'View logs',
    'runtime.recheck': 'Re-check',
    'runtime.logs.title': 'Application logs',
    'runtime.logs.openFolder': 'Open log folder',
    'runtime.logs.close': 'Close',
    'runtime.logs.noLogs': '(No logs available yet)',
    'runtime.advanced.title': 'Advanced diagnostics',
    'runtime.advanced.description': 'Keep diagnostics collapsed by default.',
    'runtime.advanced.descriptionOpen': 'Diagnostics are expanded.',
    'runtime.advanced.toggle': 'Advanced diagnostics',
    'runtime.advanced.hide': 'Hide diagnostics',
  }[key] ?? key),
}));

vi.mock('@/lib/host-api', () => ({
  hostApiFetch: (...args: unknown[]) => hostApiFetchMock(...args),
}));

vi.mock('@/lib/api-client', () => ({
  invokeIpc: (...args: unknown[]) => invokeIpcMock(...args),
}));

vi.mock('@/stores/gateway', () => ({
  useGatewayStore: Object.assign(
    (selector?: (state: typeof gatewayState) => unknown) => (
      selector ? selector(gatewayState) : gatewayState
    ),
    {
      getState: () => gatewayState,
    },
  ),
}));

vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: unknown }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: unknown }) => <>{children}</>,
  TooltipContent: ({ children }: { children: unknown }) => <>{children}</>,
}));

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>();
  return {
    ...actual,
    useTranslation: () => ({
      t: tMock,
      i18n: { language: 'en-US' },
    }),
  };
});

describe('Setup preparation stage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    gatewayState.status = { state: 'stopped', port: 18789 };
    gatewayState.start = vi.fn();
    invokeIpcMock.mockResolvedValue(undefined);
    hostApiFetchMock.mockImplementation((path: string) => {
      if (path === '/api/app/openclaw-status') {
        return Promise.resolve({
          packageExists: true,
          isBuilt: true,
          dir: '/tmp/openclaw',
          version: '1.2.3',
        });
      }
      if (path === '/api/logs?tailLines=100') {
        return Promise.resolve({ content: 'tail' });
      }
      if (path === '/api/logs/dir') {
        return Promise.resolve({ dir: '/tmp/logs' });
      }
      return Promise.resolve({});
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('keeps diagnostics collapsed by default and reveals them only after explicit expand', async () => {
    render(
      <SetupPreparationStage
        mode="fresh"
        onStatusChange={vi.fn()}
        workspacePath="/Users/test/.openclaw/workspace"
        gatewayPortInput="18789"
        onWorkspacePathChange={vi.fn()}
        onGatewayPortInputChange={vi.fn()}
        workspaceError={null}
        gatewayPortError={null}
        plan={{
          mode: 'fresh',
          canApply: true,
          blockingIssues: [],
          warnings: [],
          runtime: {
            gatewayPort: 18789,
            portAvailable: true,
            suggestedGatewayPort: 18789,
            externalGatewayDetected: false,
            configChanging: false,
          },
          workspace: {
            defaultPath: '/Users/test/.openclaw/workspace',
            configuredPaths: [],
          },
        }}
        planLoading={false}
        inspection={null}
        status={null}
        submitting={false}
      />,
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(hostApiFetchMock).toHaveBeenCalledWith('/api/app/openclaw-status');

    expect(screen.queryByRole('button', { name: 'View logs' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Re-check' })).not.toBeInTheDocument();
    expect(screen.queryByText('/tmp/openclaw')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Advanced diagnostics' }));

    expect(screen.getByRole('button', { name: 'View logs' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Re-check' })).toBeInTheDocument();
    expect(screen.getByText('/tmp/openclaw')).toBeInTheDocument();
  });

  it('shows loading feedback while logs are still being fetched', async () => {
    let resolveLogs: ((value: { content: string }) => void) | null = null;

    hostApiFetchMock.mockImplementation((path: string) => {
      if (path === '/api/app/openclaw-status') {
        return Promise.resolve({
          packageExists: true,
          isBuilt: true,
          dir: '/tmp/openclaw',
          version: '1.2.3',
        });
      }
      if (path === '/api/logs?tailLines=100') {
        return new Promise((resolve) => {
          resolveLogs = resolve;
        });
      }

      return Promise.resolve({ content: 'tail' });
    });

    render(
      <SetupPreparationStage
        mode="fresh"
        onStatusChange={vi.fn()}
        workspacePath="/Users/test/.openclaw/workspace"
        gatewayPortInput="18789"
        onWorkspacePathChange={vi.fn()}
        onGatewayPortInputChange={vi.fn()}
        workspaceError={null}
        gatewayPortError={null}
        plan={{
          mode: 'fresh',
          canApply: true,
          blockingIssues: [],
          warnings: [],
          runtime: {
            gatewayPort: 18789,
            portAvailable: true,
            suggestedGatewayPort: 18789,
            externalGatewayDetected: false,
            configChanging: false,
          },
          workspace: {
            defaultPath: '/Users/test/.openclaw/workspace',
            configuredPaths: [],
          },
        }}
        planLoading={false}
        inspection={null}
        status={null}
        submitting={false}
      />,
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Advanced diagnostics' }));
    fireEvent.click(screen.getByRole('button', { name: 'View logs' }));

    const logsAction = screen.getByRole('button', { name: 'View logs' });

    expect(logsAction).toBeDisabled();
    expect(logsAction).toHaveAttribute('aria-busy', 'true');
    expect(logsAction.querySelector('svg.animate-spin')).not.toBeNull();

    resolveLogs?.({ content: 'tail' });

    expect(await screen.findByText('tail')).toBeInTheDocument();
  });

  it('shows loading feedback while diagnostics are being re-checked', async () => {
    let resolveRecheck: ((value: { packageExists: boolean; isBuilt: boolean; dir: string; version: string }) => void) | null = null;
    let openclawCheckCalls = 0;

    hostApiFetchMock.mockImplementation((path: string) => {
      if (path === '/api/app/openclaw-status') {
        openclawCheckCalls += 1;
        if (openclawCheckCalls === 1) {
          return Promise.resolve({
            packageExists: true,
            isBuilt: true,
            dir: '/tmp/openclaw',
            version: '1.2.3',
          });
        }
        return new Promise((resolve) => {
          resolveRecheck = resolve as (value: { packageExists: boolean; isBuilt: boolean; dir: string; version: string }) => void;
        });
      }
      if (path === '/api/logs?tailLines=100') {
        return Promise.resolve({ content: 'tail' });
      }
      if (path === '/api/logs/dir') {
        return Promise.resolve({ dir: '/tmp/logs' });
      }
      return Promise.resolve({});
    });

    render(
      <SetupPreparationStage
        mode="fresh"
        onStatusChange={vi.fn()}
        workspacePath="/Users/test/.openclaw/workspace"
        gatewayPortInput="18789"
        onWorkspacePathChange={vi.fn()}
        onGatewayPortInputChange={vi.fn()}
        workspaceError={null}
        gatewayPortError={null}
        plan={{
          mode: 'fresh',
          canApply: true,
          blockingIssues: [],
          warnings: [],
          runtime: {
            gatewayPort: 18789,
            portAvailable: true,
            suggestedGatewayPort: 18789,
            externalGatewayDetected: false,
            configChanging: false,
          },
          workspace: {
            defaultPath: '/Users/test/.openclaw/workspace',
            configuredPaths: [],
          },
        }}
        planLoading={false}
        inspection={null}
        status={null}
        submitting={false}
      />,
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Advanced diagnostics' }));
    fireEvent.click(screen.getByRole('button', { name: 'Re-check' }));

    const recheckAction = screen.getByRole('button', { name: 'Re-check' });

    expect(recheckAction).toBeDisabled();
    expect(recheckAction).toHaveAttribute('aria-busy', 'true');
    expect(recheckAction.querySelector('svg.animate-spin')).not.toBeNull();

    await act(async () => {
      resolveRecheck?.({
        packageExists: true,
        isBuilt: true,
        dir: '/tmp/openclaw',
        version: '1.2.4',
      });
      await Promise.resolve();
    });

    expect((await screen.findAllByText('OpenClaw package ready v1.2.4')).length).toBeGreaterThan(0);
  });

  it('keeps the gateway start action visible and loading while the launch request is pending', async () => {
    let resolveStart: (() => void) | null = null;

    gatewayState.status = { state: 'error', error: 'Gateway failed to boot', port: 18789 };
    gatewayState.start = vi.fn(() => new Promise<void>((resolve) => {
      resolveStart = resolve;
    }));

    render(
      <SetupPreparationStage
        mode="fresh"
        onStatusChange={vi.fn()}
        workspacePath="/Users/test/.openclaw/workspace"
        gatewayPortInput="18789"
        onWorkspacePathChange={vi.fn()}
        onGatewayPortInputChange={vi.fn()}
        workspaceError={null}
        gatewayPortError={null}
        plan={{
          mode: 'fresh',
          canApply: true,
          blockingIssues: [],
          warnings: [],
          runtime: {
            gatewayPort: 18789,
            portAvailable: true,
            suggestedGatewayPort: 18789,
            externalGatewayDetected: false,
            configChanging: false,
          },
          workspace: {
            defaultPath: '/Users/test/.openclaw/workspace',
            configuredPaths: [],
          },
        }}
        planLoading={false}
        inspection={null}
        status={null}
        submitting={false}
      />,
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Advanced diagnostics' }));
    fireEvent.click(screen.getByRole('button', { name: 'Start gateway' }));

    const startGatewayAction = screen.getByRole('button', { name: 'Start gateway' });

    expect(startGatewayAction).toBeDisabled();
    expect(startGatewayAction).toHaveAttribute('aria-busy', 'true');
    expect(startGatewayAction.querySelector('svg.animate-spin')).not.toBeNull();

    await act(async () => {
      resolveStart?.();
      await Promise.resolve();
    });
  });
});
