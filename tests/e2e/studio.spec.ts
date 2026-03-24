import { expect, test, type Page, type Route } from '@playwright/test';

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

async function mockStudioApp(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem('XClaw:allow-localhost-fallback', '1');
    window.localStorage.setItem(
      'XClaw-settings',
      JSON.stringify({
        state: {
          setupComplete: true,
          theme: 'light',
          language: 'zh',
        },
        version: 0,
      }),
    );

    Object.defineProperty(window, 'electron', {
      configurable: true,
      value: {
        ipcRenderer: {
          invoke: async (channel: string, ...args: unknown[]) => {
            if (channel === 'hostapi:fetch') {
              throw new Error('window is not defined');
            }
            if (channel === 'gateway:rpc') {
              const [method] = args as [string];
              if (method === 'sessions.list') {
                return { success: true, result: { sessions: [] } };
              }
              if (method === 'chat.history') {
                return { success: true, result: { messages: [] } };
              }
              if (method === 'models.list') {
                return { success: true, result: { models: [] } };
              }
              return { success: true, result: {} };
            }
            if (channel === 'session:delete') {
              return { success: true };
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
  });

  await page.route('http://127.0.0.1:3210/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;

    if (request.method() === 'GET' && path === '/api/settings') {
      return jsonResponse(route, {
        setupComplete: true,
        theme: 'light',
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
          { id: 'main', name: 'Main Agent' },
          { id: 'planner', name: 'Planner' },
        ],
        defaultAgentId: 'main',
        configuredChannelTypes: [],
        channelOwners: {},
        channelAccountOwners: {},
      });
    }

    if (request.method() === 'GET' && path === '/api/provider-accounts') {
      return jsonResponse(route, []);
    }

    if (request.method() === 'GET' && path === '/api/providers') {
      return jsonResponse(route, []);
    }

    if (request.method() === 'GET' && path === '/api/provider-vendors') {
      return jsonResponse(route, []);
    }

    if (request.method() === 'GET' && path === '/api/provider-accounts/default') {
      return jsonResponse(route, { accountId: null });
    }

    if (request.method() === 'GET' && path === '/api/studio/runtime') {
      return jsonResponse(route, {
        status: 'ready',
        resolvedUrl: 'http://127.0.0.1:3211/electron-standalone?embedded=1&readonly=1',
        runtimeInstanceId: 'studio-runtime-1',
        lastError: null,
        port: 3211,
        python: {
          uvInstalled: true,
          interpreterReady: true,
          dependenciesReady: true,
          pythonPath: '/tmp/python3',
          venvPythonPath: '/tmp/.venv/bin/python',
          error: null,
        },
      });
    }

    if (request.method() === 'POST' && path === '/api/studio/runtime/retry') {
      return jsonResponse(route, {
        status: 'ready',
        resolvedUrl: 'http://127.0.0.1:3211/electron-standalone?embedded=1&readonly=1',
        runtimeInstanceId: 'studio-runtime-2',
        lastError: null,
        port: 3211,
        python: {
          uvInstalled: true,
          interpreterReady: true,
          dependenciesReady: true,
          pythonPath: '/tmp/python3',
          venvPythonPath: '/tmp/.venv/bin/python',
          error: null,
        },
      });
    }

    return jsonResponse(route, { success: false, error: `Unhandled route: ${request.method()} ${path}` }, 500);
  });
}

test('studio entry switches between chat and studio while preserving the embedded runtime shell', async ({ page }) => {
  await mockStudioApp(page);

  await page.goto('/#/');

  const studioButton = page.getByRole('button', { name: '工作室' });
  await expect(studioButton).toBeVisible();
  await studioButton.dispatchEvent('click');

  await expect(page).toHaveURL(/#\/studio/);
  await expect(page.locator('webview[src*="electron-standalone"]')).toHaveCount(1);
  await expect(page.getByRole('button', { name: '对话' })).toBeVisible();

  await page.getByRole('button', { name: '对话' }).dispatchEvent('click');
  await expect(page).toHaveURL(/#\/$/);
});
