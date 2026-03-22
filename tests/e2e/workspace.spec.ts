import { expect, test, type Page, type Route } from '@playwright/test';

type ThemeMode = 'light' | 'dark';

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

async function mockWorkspaceApp(page: Page, theme: ThemeMode) {
  await page.addInitScript(({ initialTheme }) => {
    window.localStorage.setItem('XClaw:allow-localhost-fallback', '1');
    window.localStorage.setItem(
      'XClaw-settings',
      JSON.stringify({
        state: {
          setupComplete: true,
          theme: initialTheme,
          language: 'zh',
        },
        version: 0,
      }),
    );

    Object.defineProperty(window, 'electron', {
      configurable: true,
      value: {
        ipcRenderer: {
          invoke: async (channel: string) => {
            if (channel === 'hostapi:fetch') {
              throw new Error('window is not defined');
            }
            if (channel === 'openclaw:getCliCommand') {
              return { success: true, command: 'openclaw' };
            }
            if (channel === 'gateway:status') {
              return { state: 'running', port: 18789 };
            }
            if (channel === 'settings:get') {
              return 18789;
            }
            return { success: true };
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
        language: 'zh',
      });
    }

    if (request.method() === 'GET' && path === '/api/gateway/status') {
      return jsonResponse(route, {
        state: 'running',
        port: 18789,
      });
    }

    if (request.method() === 'GET' && path === '/api/agents') {
      return jsonResponse(route, {
        agents: [
          {
            id: 'main',
            name: 'Main Agent',
            modelDisplay: 'Claude Sonnet 4',
            inheritedModel: false,
            isDefault: true,
            channelTypes: [],
          },
          {
            id: 'planner',
            name: 'Planner',
            modelDisplay: 'GPT-5.4',
            inheritedModel: true,
            isDefault: false,
            channelTypes: ['telegram'],
          },
        ],
        defaultAgentId: 'main',
        configuredChannelTypes: ['telegram'],
        channelOwners: { telegram: 'planner' },
        channelAccountOwners: { 'telegram:default': 'planner' },
      });
    }

    if (request.method() === 'GET' && path === '/api/channels/accounts') {
      return jsonResponse(route, {
        success: true,
        channels: [
          {
            channelType: 'telegram',
            defaultAccountId: 'default',
            status: 'connected',
            accounts: [
              {
                accountId: 'default',
                name: 'Telegram Account',
                configured: true,
                enabled: true,
                status: 'connected',
                isDefault: true,
                agentId: 'planner',
              },
            ],
          },
        ],
      });
    }

    return jsonResponse(route, { success: false, error: `Unhandled route: ${request.method()} ${path}` }, 500);
  });
}

test('settings page renders the desktop workspace shell without crashing', async ({ page }) => {
  await mockWorkspaceApp(page, 'light');

  await page.goto('/#/settings');

  await expect(page.getByRole('heading', { name: '设置' })).toBeVisible();
  await expect(page.getByText('配置您的 XClaw 体验')).toBeVisible();
  await expect(page.getByRole('heading', { name: '网关' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '关于' })).toBeVisible();
});

test('agents page renders loaded agents and bound channel summaries', async ({ page }) => {
  await mockWorkspaceApp(page, 'light');

  await page.goto('/#/agents');

  await expect(page.getByRole('heading', { name: 'Agents' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Main Agent' })).toBeVisible();
  await expect(page.getByRole('button', { name: /P Planner/ })).toBeVisible();
  await page.getByRole('button', { name: /P Planner/ }).click();
  await expect(page.getByRole('heading', { name: 'Planner' })).toBeVisible();
  await expect(page.getByText('主账号')).toBeVisible();
  await expect(page.getByText('Telegram · default')).toBeVisible();
});
