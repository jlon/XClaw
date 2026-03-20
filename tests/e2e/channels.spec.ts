import { expect, test, type Page, type Route } from '@playwright/test';

type ThemeMode = 'light' | 'dark';
type AccountStatus = 'connected' | 'connecting' | 'disconnected' | 'error';
type EditorValue = string | boolean | number | string[];

type AccountState = {
  accountId: string;
  name: string;
  configured: boolean;
  enabled: boolean;
  status: AccountStatus;
  isDefault: boolean;
  agentId?: string;
};

type ChannelState = {
  defaultAccountId: string;
  enabled: boolean;
  status: AccountStatus;
  accounts: AccountState[];
  editorValues: Record<string, Record<string, EditorValue>>;
};

function buildFixtureState() {
  return {
    channels: {
      feishu: {
        defaultAccountId: 'default',
        enabled: true,
        status: 'connected',
        accounts: [
          {
            accountId: 'default',
            name: 'Primary Account',
            configured: true,
            enabled: true,
            status: 'connected',
            isDefault: true,
            agentId: '',
          },
        ],
        editorValues: {
          default: {
            appId: 'cli_xxx',
            appSecret: 'secret',
            dmPolicy: 'open',
            groupPolicy: 'allowlist',
          },
        },
      },
      telegram: {
        defaultAccountId: 'default',
        enabled: true,
        status: 'disconnected',
        accounts: [
          {
            accountId: 'default',
            name: 'Telegram Account',
            configured: true,
            enabled: true,
            status: 'disconnected',
            isDefault: true,
          },
        ],
        editorValues: {
          default: {
            botToken: 'telegram-token',
            allowedUsers: '123456',
          },
        },
      },
    } satisfies Record<string, ChannelState>,
  };
}

function jsonResponse(route: Route, payload: unknown, status = 200) {
  return route.fulfill({
    status,
    headers: {
      'access-control-allow-origin': '*',
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

async function mockChannelsApi(page: Page, theme: ThemeMode) {
  const state = buildFixtureState();

  await page.addInitScript(({ initialTheme }) => {
    window.localStorage.setItem('XClaw:allow-localhost-fallback', '1');
    window.localStorage.setItem(
      'XClaw-settings',
      JSON.stringify({
        state: {
          setupComplete: true,
          theme: initialTheme,
          language: 'en',
        },
        version: 0,
      }),
    );

    Object.defineProperty(window, 'electron', {
      configurable: true,
      value: {
        ipcRenderer: {
          invoke: async () => {
            throw new Error('window is not defined');
          },
          on: () => () => {},
          once: () => () => {},
          off: () => {},
        },
        openExternal: () => {},
        platform: 'darwin',
        isDev: true,
      },
    });
  }, { initialTheme: theme });

  await page.route('http://127.0.0.1:3210/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;

    if (request.method() === 'GET' && path === '/api/settings') {
      return jsonResponse(route, {
        setupComplete: true,
        theme,
        language: 'en',
      });
    }

    if (request.method() === 'GET' && path === '/api/gateway/status') {
      return jsonResponse(route, {
        state: 'running',
        port: 18789,
      });
    }

    if (request.method() === 'GET' && path === '/api/channels/accounts') {
      const channels = Object.entries(state.channels).map(([channelType, channel]) => ({
        channelType,
        defaultAccountId: channel.defaultAccountId,
        enabled: channel.enabled,
        status: channel.status,
        accounts: channel.accounts,
      }));
      return jsonResponse(route, { success: true, channels });
    }

    if (request.method() === 'GET' && path === '/api/agents') {
      return jsonResponse(route, {
        success: true,
        agents: [
          { id: 'pangtong', name: 'pangtong' },
          { id: 'zhugeliang', name: 'zhugeliang' },
        ],
      });
    }

    if (request.method() === 'GET' && path.startsWith('/api/channels/config-editor/')) {
      const channelType = decodeURIComponent(path.split('/').pop() || '');
      const accountId = url.searchParams.get('accountId') || 'default';
      return jsonResponse(route, {
        success: true,
        values: state.channels[channelType]?.editorValues[accountId] || {},
      });
    }

    if (request.method() === 'POST' && path === '/api/channels/config') {
      const body = JSON.parse(request.postData() || '{}') as {
        channelType: string;
        accountId?: string;
        config?: Record<string, EditorValue>;
      };
      const accountId = body.accountId || 'default';
      const channel = state.channels[body.channelType];
      if (!channel) {
        return jsonResponse(route, { success: false, error: `Unknown channel ${body.channelType}` }, 404);
      }

      const nextValues = { ...(body.config || {}) };
      if (body.channelType === 'feishu') {
        const nextAppId = typeof nextValues.appId === 'string' ? nextValues.appId.trim() : '';
        nextValues.appId = nextAppId === 'next-app-id' ? 'normalized-app-id' : nextAppId;
      }

      channel.editorValues[accountId] = {
        ...(channel.editorValues[accountId] || {}),
        ...nextValues,
      };

      const existingAccount = channel.accounts.find((item) => item.accountId === accountId);
      if (!existingAccount) {
        channel.accounts.push({
          accountId,
          name: accountId,
          configured: true,
          enabled: true,
          status: 'connected',
          isDefault: false,
        });
      }

      return jsonResponse(route, { success: true });
    }

    if (request.method() === 'PUT' && path === '/api/channels/binding') {
      const body = JSON.parse(request.postData() || '{}') as {
        channelType?: string;
        accountId?: string;
        agentId?: string;
      };
      const channel = body.channelType ? state.channels[body.channelType] : undefined;
      const account = channel?.accounts.find((item) => item.accountId === (body.accountId || 'default'));
      if (!channel || !account) {
        return jsonResponse(route, { success: false, error: 'Unknown binding target' }, 404);
      }
      account.agentId = body.agentId || '';
      return jsonResponse(route, { success: true });
    }

    if (request.method() === 'DELETE' && path === '/api/channels/binding') {
      const body = JSON.parse(request.postData() || '{}') as {
        channelType?: string;
        accountId?: string;
      };
      const channel = body.channelType ? state.channels[body.channelType] : undefined;
      const account = channel?.accounts.find((item) => item.accountId === (body.accountId || 'default'));
      if (!channel || !account) {
        return jsonResponse(route, { success: false, error: 'Unknown binding target' }, 404);
      }
      account.agentId = '';
      return jsonResponse(route, { success: true });
    }

    return jsonResponse(route, { success: false, error: `Unhandled route: ${request.method()} ${path}` }, 500);
  });
}

test('channels center saves normalized values and reselects newly added accounts in light theme', async ({ page }) => {
  await mockChannelsApi(page, 'light');

  await page.goto('/#/channels');

  const editorAppId = page.getByLabel('App ID').first();

  await expect(page.getByTestId('channels-workbench')).toBeVisible();
  await expect(page.locator('html')).toHaveClass(/light/);
  await expect(editorAppId).toHaveValue('cli_xxx');

  await editorAppId.fill('  next-app-id  ');
  await page.getByRole('button', { name: 'Save & Reconnect' }).click();
  await expect(editorAppId).toHaveValue('normalized-app-id');

  await page.getByRole('button', { name: 'Add Account' }).click();

  const modal = page.getByTestId('channel-config-modal-card');
  await expect(modal).toBeVisible();

  const accountIdInput = modal.getByLabel('Account Identifier');
  const nextAccountId = 'feishu-e2e-secondary';

  await accountIdInput.fill(nextAccountId);
  await modal.getByLabel('App ID').fill('secondary-app');
  await modal.getByLabel('App Secret').fill('secondary-secret');
  await modal.getByRole('button', { name: 'Save & Enable' }).click();

  await expect(page.getByTestId(`channel-account-item-${nextAccountId}`)).toBeVisible();
  await expect(editorAppId).toHaveValue('secondary-app');
});

test('channels center renders correctly in dark theme and opens the add-account modal', async ({ page }) => {
  await mockChannelsApi(page, 'dark');

  await page.goto('/#/channels');

  await expect(page.getByTestId('channels-workbench')).toBeVisible();
  await expect(page.locator('html')).toHaveClass(/dark/);

  await page.getByRole('button', { name: 'Add Account' }).click();
  await expect(page.getByTestId('channel-config-modal-card')).toBeVisible();
  await expect(page.getByTestId('channel-rail-item-feishu')).toHaveAttribute('aria-pressed', 'true');
});

test('channels center uses the custom Agent select instead of a native browser select', async ({ page }) => {
  await mockChannelsApi(page, 'light');

  await page.goto('/#/channels');

  const agentSelect = page.getByTestId('channel-agent-select-trigger');

  await expect(page.getByTestId('channels-workbench')).toBeVisible();
  await expect(page.locator('select')).toHaveCount(0);
  await expect(agentSelect).toContainText('No Agent assigned');

  await agentSelect.click();
  await expect(page.getByRole('option', { name: 'pangtong' })).toBeVisible();
  await page.getByRole('option', { name: 'pangtong' }).click();

  await expect(agentSelect).toContainText('pangtong');
});
