import { expect, test, type Page, type Route } from '@playwright/test';

type ThemeMode = 'light' | 'dark';

type MockSession = {
  key: string;
  label?: string;
  displayName?: string;
  updatedAt?: number;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  contextTokens?: number;
  model?: string;
  modelProvider?: string;
};

type MockMessage = {
  role: 'user' | 'assistant' | 'system' | 'toolresult';
  content: unknown;
  timestamp?: number;
  id?: string;
};

type ChatFixture = {
  theme: ThemeMode;
  sessions: MockSession[];
  histories: Record<string, MockMessage[]>;
  historyDelayMs?: Record<string, number>;
  platform?: 'darwin' | 'win32';
};

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

async function mockChatApp(page: Page, fixture: ChatFixture) {
  await page.addInitScript(({ initialTheme, initialFixture }) => {
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

    const state = initialFixture;
    const delay = async <T,>(value: T, ms = 0): Promise<T> => {
      if (ms <= 0) return value;
      return await new Promise((resolve) => {
        window.setTimeout(() => resolve(value), ms);
      });
    };

    Object.defineProperty(window, 'electron', {
      configurable: true,
      value: {
        ipcRenderer: {
          invoke: async (channel: string, ...args: unknown[]) => {
            if (channel === 'hostapi:fetch') {
              throw new Error('window is not defined');
            }

            if (channel === 'gateway:rpc') {
              const [method, payload] = args as [string, Record<string, unknown> | undefined];
              if (method === 'sessions.list') {
                return { success: true, result: { sessions: state.sessions } };
              }
              if (method === 'chat.history') {
                const sessionKey = typeof payload?.sessionKey === 'string'
                  ? payload.sessionKey
                  : 'agent:main:main';
                const history = state.histories[sessionKey] ?? [];
                const waitMs = state.historyDelayMs?.[sessionKey] ?? 0;
                return await delay({ success: true, result: { messages: history } }, waitMs);
              }
              if (method === 'models.list') {
                return { success: true, result: { models: [] } };
              }
              return { success: true, result: {} };
            }

            if (channel === 'session:delete') {
              return { success: true };
            }

            throw new Error(`Unhandled IPC channel: ${channel}`);
          },
          on: () => () => {},
          once: () => () => {},
          off: () => {},
        },
        openExternal: () => {},
        platform: state.platform ?? 'darwin',
        isDev: true,
      },
    });
  }, { initialTheme: fixture.theme, initialFixture: fixture });

  await page.route('http://127.0.0.1:3210/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;

    if (request.method() === 'GET' && path === '/api/settings') {
      return jsonResponse(route, {
        setupComplete: true,
        theme: fixture.theme,
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
          { id: 'main', name: 'XClaw' },
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

    return jsonResponse(route, { success: false, error: `Unhandled route: ${request.method()} ${path}` }, 500);
  });
}

test('chat renders cleaned transcript content and never leaks the brand fallback into the main session title', async ({ page }) => {
  await mockChatApp(page, {
    theme: 'light',
    sessions: [
      {
        key: 'agent:main:main',
        displayName: 'XClaw',
        updatedAt: 1763800000000,
      },
      {
        key: 'agent:main:session-older',
        label: '历史会话',
        updatedAt: 1763700000000,
      },
    ],
    histories: {
      'agent:main:main': [
        { role: 'user', content: '批准了', timestamp: 1763800000, id: 'user-main-1' },
        { role: 'system', content: '/approve 08d6b8cd allow-once', timestamp: 1763800001, id: 'sys-main-1' },
        {
          role: 'assistant',
          timestamp: 1763800002,
          id: 'assistant-main-1',
          content: [
            { type: 'text', text: 'OpenClaw runtime context (internal)' },
            { type: 'text', text: 'This context is runtime-generated, not user-authored' },
            { type: 'text', text: '最终答复' },
          ],
        },
      ],
      'agent:main:session-older': [
        { role: 'user', content: '[WhatsApp 2026-03-22 10:00] 你好', timestamp: 1763700000, id: 'user-older-1' },
        { role: 'assistant', content: '<think>hidden reasoning</think>\nVisible answer', timestamp: 1763700001, id: 'assistant-older-1' },
      ],
    },
  });

  await page.goto('/#/');

  await expect(page.getByTestId('chat-user-bubble')).toContainText('批准了');
  await expect(page.getByTestId('chat-assistant-bubble')).toContainText('最终答复');
  await expect(page.getByText('/approve 08d6b8cd allow-once')).toHaveCount(0);
  await expect(page.getByText('OpenClaw runtime context (internal)')).toHaveCount(0);
  await expect(page.getByTestId('chat-sessions-scroll-area')).toContainText('批准了');
  await expect(page.getByTestId('chat-sessions-scroll-area')).not.toContainText('XClaw');
});

test('chat session switching keeps the transcript shell visible while delayed history loads and applies QClaw-style text cleanup', async ({ page }) => {
  await mockChatApp(page, {
    theme: 'light',
    sessions: [
      {
        key: 'agent:main:main',
        displayName: 'XClaw',
        updatedAt: 1763800000000,
      },
      {
        key: 'agent:main:session-older',
        label: '历史会话',
        updatedAt: 1763700000000,
      },
    ],
    histories: {
      'agent:main:main': [
        { role: 'user', content: '批准了', timestamp: 1763800000, id: 'user-main-1' },
        { role: 'assistant', content: '当前会话内容', timestamp: 1763800001, id: 'assistant-main-1' },
      ],
      'agent:main:session-older': [
        { role: 'user', content: '[WhatsApp 2026-03-22 10:00] 你好', timestamp: 1763700000, id: 'user-older-1' },
        { role: 'assistant', content: '<think>hidden reasoning</think>\nVisible answer', timestamp: 1763700001, id: 'assistant-older-1' },
      ],
    },
    historyDelayMs: {
      'agent:main:session-older': 350,
    },
  });

  await page.goto('/#/');

  await expect(page.getByText('当前会话内容')).toBeVisible();
  await page.getByRole('button', { name: '你好' }).click();

  await expect(page.getByTestId('chat-welcome-hero')).toHaveCount(0);
  await expect(page.getByText('Visible answer')).toBeVisible();
  await expect(page.getByText('hidden reasoning')).toHaveCount(0);
  await expect(page.getByTestId('chat-user-bubble')).toContainText('你好');
  await expect(page.getByTestId('chat-user-bubble')).not.toContainText('WhatsApp');
  await expect(page.getByTestId('chat-sessions-scroll-area')).not.toContainText('[WhatsApp');
});

test('chat welcome hero seeds the composer when a workbench card is selected', async ({ page }) => {
  await mockChatApp(page, {
    theme: 'light',
    sessions: [],
    histories: {
      'agent:main:main': [],
    },
  });

  await page.goto('/#/');

  await expect(page.getByTestId('chat-welcome-hero')).toBeVisible();
  const textarea = page.locator('textarea');
  await expect(textarea).toHaveValue('');

  await page.getByTestId('chat-welcome-hero').locator('button').nth(0).click();

  await expect(textarea).not.toHaveValue('');
});

test('chat slash menu runs local /usage inline on win32 without navigating away', async ({ page }) => {
  await mockChatApp(page, {
    theme: 'light',
    platform: 'win32',
    sessions: [
      {
        key: 'agent:main:main',
        displayName: 'XClaw',
        updatedAt: 1763800000000,
        inputTokens: 100,
        outputTokens: 20,
        totalTokens: 120,
      },
    ],
    histories: {
      'agent:main:main': [],
    },
  });

  await page.goto('/#/');

  const textarea = page.locator('textarea');
  await textarea.fill('/us');
  await expect(page.getByText('/usage')).toBeVisible();

  await textarea.fill('/usage ');
  await textarea.press('Enter');

  await expect(page.getByText('Session Usage')).toBeVisible();
  await expect(page.getByText('Input: 100 tokens')).toBeVisible();
  await expect(page).not.toHaveURL(/#\/models$/);
});
