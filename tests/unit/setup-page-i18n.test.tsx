import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { Setup } from '@/pages/Setup/index';

const {
  hostApiFetchMock,
  invokeIpcMock,
  navigateMock,
  settingsState,
  gatewayState,
  tMock,
} = vi.hoisted(() => {
  const markSetupComplete = vi.fn().mockResolvedValue(undefined);
  return {
    hostApiFetchMock: vi.fn(),
    invokeIpcMock: vi.fn(),
    navigateMock: vi.fn(),
    settingsState: {
      language: 'en-US',
      devModeUnlocked: false,
      gatewayPort: 18789,
      markSetupComplete,
      setGatewayPort: vi.fn(),
      setLanguage: vi.fn(),
    },
    gatewayState: {
      status: { state: 'stopped', port: 18789 },
      init: vi.fn().mockResolvedValue(undefined),
      start: vi.fn(),
    },
    tMock: (key: string, options?: Record<string, unknown>) => ({
      'welcome.title': 'Welcome to XClaw',
      'welcome.description': 'Welcome description',
      'welcome.features.noCommand': 'No terminal required',
      'welcome.features.modernUI': 'Desktop-grade interface',
      'welcome.features.bundles': 'Built-in skills',
      'welcome.features.crossPlatform': 'Cross-platform',
      'nav.next': 'Next',
      'nav.back': 'Back',
      'nav.getStarted': 'Get Started',
      'wizard.rail.title': 'Guided Setup',
      'wizard.rail.aria': 'Setup steps',
      'wizard.stages.start.label': 'Start',
      'wizard.stages.start.description': 'Choose how to begin',
      'wizard.stages.preparation.label': 'Preparation',
      'wizard.stages.preparation.description': 'Check the environment and import readiness',
      'wizard.stages.provider.label': 'Model Access',
      'wizard.stages.provider.description': 'Confirm provider access',
      'wizard.stages.complete.label': 'Finish',
      'wizard.stages.complete.description': 'Review the setup summary',
      'wizard.stages.complete.applyingDescription': 'Applying the final changes',
      'wizard.actions.takeoverImport': 'Import and Continue',
      'wizard.actions.reviewSummary': 'Review Summary',
      'wizard.actions.providerSubmit': 'Save and Continue',
      'wizard.footer.start.title': 'Start setup',
      'wizard.footer.start.body': 'Choose how to begin before continuing.',
      'wizard.footer.start.primary': 'Next',
      'wizard.footer.start.secondary': 'Exit setup',
      'wizard.footer.preparation.title': 'Preparation',
      'wizard.footer.preparation.body': 'Confirm the environment before moving on.',
      'wizard.footer.preparation.primary': 'Next',
      'wizard.footer.preparation.secondary': 'Back',
      'wizard.footer.provider.title': 'Model Access',
      'wizard.footer.provider.body': 'Choose the access method before continuing.',
      'wizard.footer.provider.primary': 'Next',
      'wizard.footer.provider.secondary': 'Back',
      'wizard.footer.complete.title': 'Finish',
      'wizard.footer.complete.body': 'Review the changes and enter the app.',
      'wizard.footer.complete.primary': 'Enter XClaw',
      'wizard.footer.complete.secondary': 'Back',
      'wizard.footer.applying.title': 'Applying changes',
      'wizard.footer.applying.body': 'Keep this window open until the summary appears.',
      'wizard.exitDialog.title': 'Exit setup now?',
      'wizard.exitDialog.message': 'Leaving now will not mark setup as complete.',
      'wizard.exitDialog.applyingTitle': 'Changes are still applying. Exit anyway?',
      'wizard.exitDialog.applyingMessage': 'The changes are not finished yet.',
      'wizard.exitDialog.confirm': 'Exit',
      'wizard.exitDialog.cancel': 'Stay here',
      'wizard.loading.description': 'Inspecting the local OpenClaw environment...',
      'wizard.errorState.title': 'Unable to inspect the installation environment',
      'wizard.errorState.retry': 'Try again',
    }[key] ?? (options?.port ? `${key}:${String(options.port)}` : key)),
  };
});

vi.mock('@/lib/host-api', () => ({
  hostApiFetch: (...args: unknown[]) => hostApiFetchMock(...args),
}));

vi.mock('@/lib/api-client', () => ({
  invokeIpc: (...args: unknown[]) => invokeIpcMock(...args),
}));

vi.mock('@/lib/host-events', () => ({
  subscribeHostEvent: vi.fn().mockReturnValue(() => {}),
}));

vi.mock('@/stores/settings', () => ({
  useSettingsStore: Object.assign(
    (selector?: (state: typeof settingsState) => unknown) => (
      selector ? selector(settingsState) : settingsState
    ),
    {
      getState: () => settingsState,
    },
  ),
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

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: unknown }) => <>{children}</>,
  motion: new Proxy({}, {
    get: () => ({ children, layout: _layout, ...props }: { children: unknown; layout?: unknown }) => <div {...props}>{children}</div>,
  }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

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

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

describe('Setup page i18n', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    settingsState.language = 'en-US';
    gatewayState.status = { state: 'stopped', port: 18789 };
    gatewayState.init = vi.fn().mockResolvedValue(undefined);
    gatewayState.start = vi.fn();
    invokeIpcMock.mockResolvedValue(false);
    hostApiFetchMock.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path === '/api/app/setup-inspection') {
        return {
          hasExistingOpenClaw: false,
          suggestedMode: 'fresh',
          gatewayPort: 18789,
          defaultWorkspacePath: '/Users/test/.openclaw/workspace',
        };
      }

      if (path === '/api/app/setup-plan' && init?.method === 'POST') {
        return {
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
        };
      }

      throw new Error(`Unexpected host API path: ${path}`);
    });
  });

  it('uses translated rail labels and footer actions instead of hard-coded Chinese copy', async () => {
    render(<Setup />);

    await waitFor(() => {
      expect(screen.getByText('Guided Setup')).toBeInTheDocument();
    });

    expect(screen.getByText('Start')).toBeInTheDocument();
    expect(screen.getByText('Preparation')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next' })).toBeInTheDocument();
    expect(screen.queryByText('开始')).not.toBeInTheDocument();
  }, 10000);
});
