import { describe, expect, it, vi } from 'vitest';
import { createServer } from 'node:net';
import { WebSocketServer } from 'ws';
import type { SetupBootstrapState } from '@electron/main/setup-bootstrap';
import {
  buildSetupPlan,
  inspectLocalOpenClawSetup,
  isLocalGatewayPortAvailable,
  summarizeProviderImport,
} from '@electron/main/setup-inspection';

const pendingBootstrapState: SetupBootstrapState = {
  setupComplete: false,
  source: 'pending',
  readonly: true,
  shouldRunStartupSideEffects: false,
};

describe('summarizeProviderImport', () => {
  it('summarizes supported, custom and conflicting providers from runtime data', () => {
    const summary = summarizeProviderImport({
      config: {
        models: {
          providers: {
            openai: {
              baseUrl: 'https://api.openai.com/v1',
              api: 'openai-responses',
            },
            'external-compatible': {
              baseUrl: 'https://example.com/v1',
              api: 'openai-completions',
            },
          },
        },
        plugins: {
          entries: {
            'qwen-portal-auth': {
              enabled: true,
            },
          },
        },
        agents: {
          defaults: {
            model: {
              primary: 'openai/gpt-5.2',
            },
          },
        },
      },
      authProfilesByAgent: {
        main: {
          version: 1,
          profiles: {
            'openai:default': {
              type: 'api_key',
              provider: 'openai',
              key: 'sk-main',
            },
          },
        },
        reviewer: {
          version: 1,
          profiles: {
            'openai:default': {
              type: 'api_key',
              provider: 'openai',
              key: 'sk-reviewer',
            },
          },
        },
      },
    });

    expect(summary.defaultRuntimeProviderKey).toBe('openai');
    expect(summary.importableCount).toBe(3);
    expect(summary.conflictCount).toBe(1);
    expect(summary.requiresReview).toBe(true);
    expect(summary.accounts).toEqual(expect.arrayContaining([
      expect.objectContaining({
        runtimeProviderKey: 'openai',
        importSource: 'supported',
        conflict: true,
      }),
      expect.objectContaining({
        runtimeProviderKey: 'external-compatible',
        importSource: 'custom',
        conflict: false,
      }),
      expect.objectContaining({
        runtimeProviderKey: 'qwen-portal',
        importSource: 'supported',
      }),
    ]));
  });

  it('marks unsupported providers when runtime metadata is insufficient', () => {
    const summary = summarizeProviderImport({
      config: {
        models: {
          providers: {
            mystery: {},
          },
        },
      },
      authProfilesByAgent: {},
    });

    expect(summary.importableCount).toBe(0);
    expect(summary.unsupportedCount).toBe(1);
    expect(summary.requiresReview).toBe(true);
    expect(summary.accounts[0]).toEqual(expect.objectContaining({
      runtimeProviderKey: 'mystery',
      importSource: 'unsupported',
    }));
  });
});

describe('buildSetupPlan', () => {
  it('blocks takeover when runtime freeze checks fail', () => {
    const plan = buildSetupPlan({
      generatedAt: '2026-03-19T03:00:00.000Z',
      bootstrap: pendingBootstrapState,
      hasExistingOpenClaw: true,
      openClawDir: '/Users/test/.openclaw',
      hasLegacyClawXFootprint: false,
      defaultWorkspacePath: '/Users/test/.openclaw/workspace',
      configuredWorkspacePaths: ['/Users/test/.openclaw/workspace'],
      gatewayPort: 18789,
      runtime: {
        portAvailable: false,
        suggestedGatewayPort: 18790,
        externalGatewayDetected: true,
        configChanging: true,
      },
      counts: {
        agents: 2,
        channels: 1,
        skills: 3,
        extensions: 4,
        runtimeProviders: 2,
        providerAccounts: 2,
      },
      providerImport: {
        defaultRuntimeProviderKey: 'openai',
        importableCount: 2,
        conflictCount: 1,
        unsupportedCount: 0,
        requiresReview: true,
        accounts: [],
      },
      warnings: [],
      errors: [],
      suggestedMode: 'takeover',
    }, { mode: 'takeover' });

    expect(plan.mode).toBe('takeover');
    expect(plan.canApply).toBe(false);
    expect(plan.blockingIssues).toEqual(expect.arrayContaining([
      expect.stringContaining('端口'),
      expect.stringContaining('Gateway'),
      expect.stringContaining('配置'),
    ]));
    expect(plan.providerImport.requiresReview).toBe(true);
  });

  it('allows takeover to reuse an existing running gateway on the configured port', () => {
    const plan = buildSetupPlan({
      generatedAt: '2026-03-19T03:00:00.000Z',
      bootstrap: pendingBootstrapState,
      hasExistingOpenClaw: true,
      openClawDir: '/Users/test/.openclaw',
      hasLegacyClawXFootprint: false,
      defaultWorkspacePath: '/Users/test/.openclaw/workspace',
      configuredWorkspacePaths: ['/Users/test/.openclaw/workspace'],
      gatewayPort: 18789,
      runtime: {
        portAvailable: false,
        suggestedGatewayPort: 18790,
        externalGatewayDetected: true,
        configChanging: false,
      },
      counts: {
        agents: 2,
        channels: 1,
        skills: 3,
        extensions: 4,
        runtimeProviders: 2,
        providerAccounts: 2,
      },
      providerImport: {
        defaultRuntimeProviderKey: 'openai',
        importableCount: 2,
        conflictCount: 0,
        unsupportedCount: 0,
        requiresReview: false,
        accounts: [],
      },
      warnings: [],
      errors: [],
      suggestedMode: 'takeover',
    }, { mode: 'takeover' });

    expect(plan.canApply).toBe(true);
    expect(plan.blockingIssues).toEqual([]);
    expect(plan.warnings).toEqual(expect.arrayContaining([
      expect.stringContaining('Gateway'),
      expect.stringContaining('复用'),
    ]));
  });

  it('blocks takeover when the configured gateway port is occupied even if no external gateway handshake succeeds', () => {
    const plan = buildSetupPlan({
      generatedAt: '2026-03-19T03:00:00.000Z',
      bootstrap: pendingBootstrapState,
      hasExistingOpenClaw: true,
      openClawDir: '/Users/test/.openclaw',
      hasLegacyClawXFootprint: false,
      defaultWorkspacePath: '/Users/test/.openclaw/workspace',
      configuredWorkspacePaths: ['/Users/test/.openclaw/workspace'],
      gatewayPort: 18789,
      runtime: {
        portAvailable: false,
        suggestedGatewayPort: 18790,
        externalGatewayDetected: false,
        configChanging: false,
      },
      counts: {
        agents: 1,
        channels: 0,
        skills: 1,
        extensions: 0,
        runtimeProviders: 1,
        providerAccounts: 1,
      },
      providerImport: {
        defaultRuntimeProviderKey: 'openai',
        importableCount: 1,
        conflictCount: 0,
        unsupportedCount: 0,
        requiresReview: false,
        accounts: [],
      },
      warnings: [],
      errors: [],
      suggestedMode: 'takeover',
    }, { mode: 'takeover' });

    expect(plan.canApply).toBe(false);
    expect(plan.blockingIssues).toEqual([
      '检测到目标网关端口 18789 已被占用，请先释放或改用 18790 后再继续接管',
    ]);
  });

  it('blocks fresh setup when the requested workspace path is invalid', () => {
    const plan = buildSetupPlan({
      generatedAt: '2026-03-19T03:00:00.000Z',
      bootstrap: pendingBootstrapState,
      hasExistingOpenClaw: false,
      openClawDir: '/Users/test/.openclaw',
      hasLegacyClawXFootprint: false,
      defaultWorkspacePath: '/Users/test/.openclaw/workspace',
      configuredWorkspacePaths: ['/Users/test/.openclaw/workspace'],
      gatewayPort: 18789,
      runtime: {
        portAvailable: true,
        suggestedGatewayPort: 18789,
        externalGatewayDetected: false,
        configChanging: false,
      },
      counts: {
        agents: 0,
        channels: 0,
        skills: 0,
        extensions: 0,
        runtimeProviders: 0,
        providerAccounts: 0,
      },
      providerImport: {
        defaultRuntimeProviderKey: null,
        importableCount: 0,
        conflictCount: 0,
        unsupportedCount: 0,
        requiresReview: false,
        accounts: [],
      },
      warnings: [],
      errors: [],
      suggestedMode: 'fresh',
    }, {
      mode: 'fresh',
      workspacePath: 'relative/workspace',
    });

    expect(plan.canApply).toBe(false);
    expect(plan.blockingIssues).toContain('工作区路径必须是绝对路径');
  });

  it('prefills fresh setup with a non-conflicting port and workspace when an existing installation is detected', () => {
    const plan = buildSetupPlan({
      generatedAt: '2026-03-19T03:00:00.000Z',
      bootstrap: pendingBootstrapState,
      hasExistingOpenClaw: true,
      openClawDir: '/Users/test/.openclaw',
      hasLegacyClawXFootprint: false,
      defaultWorkspacePath: '/Users/test/.openclaw/workspace',
      configuredWorkspacePaths: ['/Users/test/.openclaw/workspace'],
      gatewayPort: 18789,
      runtime: {
        portAvailable: false,
        suggestedGatewayPort: 18790,
        externalGatewayDetected: true,
        configChanging: false,
      },
      counts: {
        agents: 2,
        channels: 1,
        skills: 3,
        extensions: 4,
        runtimeProviders: 2,
        providerAccounts: 2,
      },
      providerImport: {
        defaultRuntimeProviderKey: 'bailian',
        importableCount: 2,
        conflictCount: 0,
        unsupportedCount: 1,
        requiresReview: true,
        accounts: [],
      },
      warnings: [
        '检测到需要人工确认的 provider 导入项',
        '检测到现有 Gateway 正在使用端口 18789，接管时将尝试直接复用当前实例',
      ],
      errors: [],
      suggestedMode: 'takeover',
    }, { mode: 'fresh' });

    expect(plan.canApply).toBe(true);
    expect(plan.blockingIssues).toEqual([]);
    expect(plan.runtime.gatewayPort).toBe(18790);
    expect(plan.runtime.portAvailable).toBe(true);
    expect(plan.runtime.externalGatewayDetected).toBe(false);
    expect(plan.workspace.defaultPath).toBe('/Users/test/.openclaw/workspace-xclaw');
    expect(plan.warnings).toEqual([]);
  });
});

describe('inspectLocalOpenClawSetup', () => {
  it('returns a fresh setup summary when no local openclaw installation exists', async () => {
    const inspection = await inspectLocalOpenClawSetup({
      now: () => new Date('2026-03-19T03:00:00.000Z'),
      resolveBootstrapState: vi.fn().mockResolvedValue(pendingBootstrapState),
      detectLegacyFootprint: vi.fn().mockResolvedValue(false),
      getSettings: vi.fn().mockResolvedValue({ gatewayPort: 18789 }),
      fileExists: vi.fn().mockResolvedValue(false),
      readFile: vi.fn(),
      readdirNames: vi.fn().mockResolvedValue([]),
      listConfiguredAgentIds: vi.fn().mockResolvedValue([]),
      listConfiguredChannels: vi.fn().mockResolvedValue([]),
      checkPortAvailability: vi.fn().mockResolvedValue(true),
      findSuggestedPort: vi.fn().mockResolvedValue(18789),
      detectExternalGateway: vi.fn().mockResolvedValue(false),
      detectConfigChanging: vi.fn().mockResolvedValue(false),
    });

    expect(inspection.hasExistingOpenClaw).toBe(false);
    expect(inspection.suggestedMode).toBe('fresh');
    expect(inspection.gatewayPort).toBe(18789);
    expect(inspection.runtime.portAvailable).toBe(true);
    expect(inspection.counts).toEqual({
      agents: 0,
      channels: 0,
      skills: 0,
      extensions: 0,
      runtimeProviders: 0,
      providerAccounts: 0,
    });
  });

  it('uses requested fresh setup overrides for gateway port and workspace path', async () => {
    const inspection = await inspectLocalOpenClawSetup({
      requestedGatewayPort: 19001,
      requestedWorkspacePath: '/Users/test/custom-workspace',
      now: () => new Date('2026-03-19T03:00:00.000Z'),
      resolveBootstrapState: vi.fn().mockResolvedValue(pendingBootstrapState),
      detectLegacyFootprint: vi.fn().mockResolvedValue(false),
      getSettings: vi.fn().mockResolvedValue({ gatewayPort: 18789 }),
      fileExists: vi.fn().mockResolvedValue(false),
      readFile: vi.fn(),
      readdirNames: vi.fn().mockResolvedValue([]),
      listConfiguredAgentIds: vi.fn().mockResolvedValue([]),
      listConfiguredChannels: vi.fn().mockResolvedValue([]),
      checkPortAvailability: vi.fn().mockResolvedValue(true),
      findSuggestedPort: vi.fn().mockResolvedValue(19001),
      detectExternalGateway: vi.fn().mockResolvedValue(false),
      detectConfigChanging: vi.fn().mockResolvedValue(false),
    });

    expect(inspection.gatewayPort).toBe(19001);
    expect(inspection.defaultWorkspacePath).toBe('/Users/test/custom-workspace');
    expect(inspection.configuredWorkspacePaths[0]).toBe('/Users/test/custom-workspace');
  });

  it('does not treat a plain websocket listener as a reusable external gateway', async () => {
    const gatewayServer = new WebSocketServer({ host: '127.0.0.1', port: 0 });
    await new Promise<void>((resolve) => {
      gatewayServer.once('listening', () => resolve());
    });
    const address = gatewayServer.address();
    const port = typeof address === 'object' && address ? address.port : 0;

    try {
      const inspection = await inspectLocalOpenClawSetup({
        now: () => new Date('2026-03-19T03:00:00.000Z'),
        resolveBootstrapState: vi.fn().mockResolvedValue(pendingBootstrapState),
        detectLegacyFootprint: vi.fn().mockResolvedValue(false),
        getSettings: vi.fn().mockResolvedValue({ gatewayPort: port }),
        fileExists: vi.fn().mockResolvedValue(false),
        readFile: vi.fn(),
        readdirNames: vi.fn().mockResolvedValue([]),
        listConfiguredAgentIds: vi.fn().mockResolvedValue([]),
        listConfiguredChannels: vi.fn().mockResolvedValue([]),
        checkPortAvailability: vi.fn().mockResolvedValue(false),
        findSuggestedPort: vi.fn().mockResolvedValue(port + 1),
        detectConfigChanging: vi.fn().mockResolvedValue(false),
      });

      expect(inspection.runtime.externalGatewayDetected).toBe(false);
    } finally {
      await new Promise<void>((resolve, reject) => {
        gatewayServer.close((error) => error ? reject(error) : resolve());
      });
    }
  });

  it('recognizes an external gateway only after the protocol challenge is emitted', async () => {
    const gatewayServer = new WebSocketServer({ host: '127.0.0.1', port: 0 });
    gatewayServer.on('connection', (socket) => {
      socket.send(JSON.stringify({
        type: 'event',
        event: 'connect.challenge',
        payload: {
          nonce: 'test-nonce',
        },
      }));
    });
    await new Promise<void>((resolve) => {
      gatewayServer.once('listening', () => resolve());
    });
    const address = gatewayServer.address();
    const port = typeof address === 'object' && address ? address.port : 0;

    try {
      const inspection = await inspectLocalOpenClawSetup({
        now: () => new Date('2026-03-19T03:00:00.000Z'),
        resolveBootstrapState: vi.fn().mockResolvedValue(pendingBootstrapState),
        detectLegacyFootprint: vi.fn().mockResolvedValue(false),
        getSettings: vi.fn().mockResolvedValue({ gatewayPort: port }),
        fileExists: vi.fn().mockResolvedValue(false),
        readFile: vi.fn(),
        readdirNames: vi.fn().mockResolvedValue([]),
        listConfiguredAgentIds: vi.fn().mockResolvedValue([]),
        listConfiguredChannels: vi.fn().mockResolvedValue([]),
        checkPortAvailability: vi.fn().mockResolvedValue(false),
        findSuggestedPort: vi.fn().mockResolvedValue(port + 1),
        detectConfigChanging: vi.fn().mockResolvedValue(false),
      });

      expect(inspection.runtime.externalGatewayDetected).toBe(true);
    } finally {
      await new Promise<void>((resolve, reject) => {
        gatewayServer.close((error) => error ? reject(error) : resolve());
      });
    }
  });
});

describe('isLocalGatewayPortAvailable', () => {
  it('returns false when 127.0.0.1 is already occupied by a local listener', async () => {
    const server = createServer();
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', () => resolve());
    });

    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;

    try {
      expect(await isLocalGatewayPortAvailable(port)).toBe(false);
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
      });
    }
  });
});
