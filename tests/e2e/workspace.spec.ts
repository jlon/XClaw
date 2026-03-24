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
            workspace: '/tmp/openclaw/workspaces/main',
            agentDir: '/tmp/openclaw/agents/main',
            channelTypes: [],
          },
          {
            id: 'planner',
            name: 'Planner',
            modelDisplay: 'GPT-5.4',
            inheritedModel: true,
            isDefault: false,
            workspace: '/tmp/openclaw/workspaces/planner',
            agentDir: '/tmp/openclaw/agents/planner',
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

    if (request.method() === 'GET' && /^\/api\/agents\/[^/]+\/files$/.test(path)) {
      return jsonResponse(route, {
        success: true,
        files: [
          {
            relativePath: 'AGENTS.md',
            displayName: 'AGENTS.md',
            reserved: true,
            editable: true,
          },
        ],
      });
    }

    if (request.method() === 'GET' && /^\/api\/agents\/[^/]+\/files\/content$/.test(path)) {
      return jsonResponse(route, {
        success: true,
        content: '# Agent Workspace\n',
      });
    }

    return jsonResponse(route, { success: false, error: `Unhandled route: ${request.method()} ${path}` }, 500);
  });
}

test('settings page renders the desktop workspace shell without crashing', async ({ page }) => {
  await mockWorkspaceApp(page, 'light');

  await page.goto('/#/settings');

  await expect(page.getByRole('tab', { name: '通用' })).toBeVisible();
  await expect(page.getByRole('tab', { name: '网关' })).toBeVisible();
  await expect(page.getByRole('tab', { name: '更新' })).toBeVisible();
  await expect(page.getByText('主题')).toBeVisible();
  await expect(page.getByText('语言')).toBeVisible();

  await page.getByRole('tab', { name: '网关' }).click();
  await expect(page.getByText('状态')).toBeVisible();
  await expect(page.getByText('端口')).toBeVisible();
  await expect(page.getByTestId('workbench-summary-item-auto-start')).toBeVisible();

  await page.getByRole('tab', { name: '更新' }).click();
  await expect(page.getByText('当前版本')).toBeVisible();
});

test('agents page renders loaded agents and bound channel summaries', async ({ page }) => {
  await mockWorkspaceApp(page, 'light');

  await page.goto('/#/agents');

  await expect(page.getByRole('heading', { name: '智能体' })).toBeVisible();
  await expect(page.getByTestId('agents-detail-workbench').getByRole('heading', { name: 'Main Agent' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Planner/ }).first()).toBeVisible();
  await page.getByRole('button', { name: /Planner/ }).first().click();
  await expect(page.getByTestId('agents-detail-workbench').getByRole('heading', { name: 'Planner' })).toBeVisible();
  await page.getByRole('button', { name: '绑定与运行' }).click();
  await expect(page.getByText('主账号')).toBeVisible();
  await expect(page.getByText('telegram')).toBeVisible();
  await expect(page.getByText('default')).toBeVisible();
});
