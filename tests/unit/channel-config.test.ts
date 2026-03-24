import { mkdir, readFile, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { testHome, testUserData, mockLoggerWarn, mockLoggerInfo, mockLoggerError } = vi.hoisted(() => {
  const suffix = Math.random().toString(36).slice(2);
  return {
    testHome: `/tmp/XClaw-channel-config-${suffix}`,
    testUserData: `/tmp/XClaw-channel-config-user-data-${suffix}`,
    mockLoggerWarn: vi.fn(),
    mockLoggerInfo: vi.fn(),
    mockLoggerError: vi.fn(),
  };
});

vi.mock('os', async () => {
  const actual = await vi.importActual<typeof import('os')>('os');
  const mocked = {
    ...actual,
    homedir: () => testHome,
  };
  return {
    ...mocked,
    default: mocked,
  };
});

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getPath: () => testUserData,
    getVersion: () => '0.0.0-test',
    getAppPath: () => '/tmp',
  },
}));

vi.mock('@electron/utils/logger', () => ({
  warn: mockLoggerWarn,
  info: mockLoggerInfo,
  error: mockLoggerError,
}));

async function readOpenClawJson(): Promise<Record<string, unknown>> {
  const content = await readFile(join(testHome, '.openclaw', 'openclaw.json'), 'utf8');
  return JSON.parse(content) as Record<string, unknown>;
}

describe('channel credential normalization and duplicate checks', () => {
  beforeEach(async () => {
    vi.resetAllMocks();
    vi.resetModules();
    await rm(testHome, { recursive: true, force: true });
    await rm(testUserData, { recursive: true, force: true });
  });

  it('assertNoDuplicateCredential detects duplicates with different whitespace', async () => {
    const { saveChannelConfig } = await import('@electron/utils/channel-config');

    await saveChannelConfig('feishu', { appId: 'bot-123', appSecret: 'secret-a' }, 'agent-a');

    await expect(
      saveChannelConfig('feishu', { appId: '  bot-123  ', appSecret: 'secret-b' }, 'agent-b'),
    ).rejects.toThrow('already bound to another agent');
  });

  it('assertNoDuplicateCredential does NOT detect duplicates with different case', async () => {
    // Case-sensitive credentials (like tokens) should NOT be normalized to lowercase
    // to avoid false positives where different tokens become the same after lowercasing
    const { saveChannelConfig } = await import('@electron/utils/channel-config');

    await saveChannelConfig('feishu', { appId: 'Bot-ABC', appSecret: 'secret-a' }, 'agent-a');

    // Should NOT throw - different case is considered a different credential
    await expect(
      saveChannelConfig('feishu', { appId: 'bot-abc', appSecret: 'secret-b' }, 'agent-b'),
    ).resolves.not.toThrow();
  });

  it('normalizes credential values when saving (trim only, preserve case)', async () => {
    const { saveChannelConfig } = await import('@electron/utils/channel-config');

    await saveChannelConfig('feishu', { appId: '  BoT-XyZ  ', appSecret: 'secret' }, 'agent-a');

    const config = await readOpenClawJson();
    const channels = config.channels as Record<string, { accounts: Record<string, { appId?: string }> }>;
    // Should trim whitespace but preserve original case
    expect(channels.feishu.accounts['agent-a'].appId).toBe('BoT-XyZ');
  });

  it('emits warning logs when credential normalization (trim) occurs', async () => {
    const { saveChannelConfig } = await import('@electron/utils/channel-config');

    await saveChannelConfig('feishu', { appId: '  BoT-Log  ', appSecret: 'secret' }, 'agent-a');

    expect(mockLoggerWarn).toHaveBeenCalledWith(
      'Normalized channel credential value for duplicate check',
      expect.objectContaining({ channelType: 'feishu', accountId: 'agent-a', key: 'appId' }),
    );
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      'Normalizing channel credential value before save',
      expect.objectContaining({ channelType: 'feishu', accountId: 'agent-a', key: 'appId' }),
    );
  });
});

describe('parseDoctorValidationOutput', () => {
  it('extracts channel error and warning lines', async () => {
    const { parseDoctorValidationOutput } = await import('@electron/utils/channel-config');

    const out = parseDoctorValidationOutput(
      'feishu',
      'feishu error: token invalid\nfeishu warning: fallback enabled\n',
    );

    expect(out.undetermined).toBe(false);
    expect(out.errors).toEqual(['feishu error: token invalid']);
    expect(out.warnings).toEqual(['feishu warning: fallback enabled']);
  });

  it('falls back with hint when output has no channel signal', async () => {
    const { parseDoctorValidationOutput } = await import('@electron/utils/channel-config');

    const out = parseDoctorValidationOutput('feishu', 'all good, no channel details');

    expect(out.undetermined).toBe(true);
    expect(out.errors).toEqual([]);
    expect(out.warnings.some((w: string) => w.includes('falling back to local channel config checks'))).toBe(true);
  });

  it('falls back with hint when output is empty', async () => {
    const { parseDoctorValidationOutput } = await import('@electron/utils/channel-config');

    const out = parseDoctorValidationOutput('feishu', '   ');

    expect(out.undetermined).toBe(true);
    expect(out.errors).toEqual([]);
    expect(out.warnings.some((w: string) => w.includes('falling back to local channel config checks'))).toBe(true);
  });
});

describe('WeCom plugin configuration', () => {
  beforeEach(async () => {
    vi.resetAllMocks();
    vi.resetModules();
    await rm(testHome, { recursive: true, force: true });
    await rm(testUserData, { recursive: true, force: true });
  });

  it('sets plugins.entries.wecom.enabled when saving wecom config', async () => {
    const { saveChannelConfig } = await import('@electron/utils/channel-config');

    await saveChannelConfig('wecom', { botId: 'test-bot', secret: 'test-secret' }, 'agent-a');

    const config = await readOpenClawJson();
    const plugins = config.plugins as { allow: string[], entries: Record<string, { enabled?: boolean }> };
    
    expect(plugins.allow).toContain('wecom');
    expect(plugins.entries['wecom'].enabled).toBe(true);
  });
});

describe('Feishu plugin configuration', () => {
  beforeEach(async () => {
    vi.resetAllMocks();
    vi.resetModules();
    await rm(testHome, { recursive: true, force: true });
    await rm(testUserData, { recursive: true, force: true });
  });

  it('sets plugins.entries.openclaw-lark.enabled when saving feishu config', async () => {
    const { saveChannelConfig } = await import('@electron/utils/channel-config');

    await saveChannelConfig('feishu', { appId: 'test-app', appSecret: 'test-secret' }, 'agent-a');

    const config = await readOpenClawJson();
    const plugins = config.plugins as { allow: string[], entries: Record<string, { enabled?: boolean }> };

    expect(plugins.allow).toContain('openclaw-lark');
    expect(plugins.allow).not.toContain('feishu-openclaw-plugin');
    expect(plugins.entries['openclaw-lark'].enabled).toBe(true);
    expect(plugins.entries).not.toHaveProperty('feishu-openclaw-plugin');
  });
});

describe('Weixin plugin configuration', () => {
  beforeEach(async () => {
    vi.resetAllMocks();
    vi.resetModules();
    await rm(testHome, { recursive: true, force: true });
    await rm(testUserData, { recursive: true, force: true });
  });

  it('writes account config and enables the openclaw-weixin plugin allowlist', async () => {
    const { saveChannelConfig } = await import('@electron/utils/channel-config');

    await saveChannelConfig(
      'openclaw-weixin',
      {
        name: 'WeChat Bot',
        cdnBaseUrl: 'https://cdn.example.com',
        routeTag: 7,
      },
      'wx-bot',
    );

    const config = await readOpenClawJson();
    const plugins = config.plugins as { allow: string[], entries: Record<string, { enabled?: boolean }> };
    const channels = config.channels as Record<string, {
      defaultAccount?: string;
      accounts: Record<string, { name?: string; cdnBaseUrl?: string; routeTag?: number; enabled?: boolean }>;
    }>;

    expect(plugins.allow).toContain('openclaw-weixin');
    expect(plugins.entries['openclaw-weixin'].enabled).toBe(true);
    expect(channels['openclaw-weixin'].defaultAccount).toBe('wx-bot');
    expect(channels['openclaw-weixin'].accounts['wx-bot']).toEqual(
      expect.objectContaining({
        name: 'WeChat Bot',
        cdnBaseUrl: 'https://cdn.example.com',
        routeTag: 7,
        enabled: true,
      }),
    );
  });
});

describe('channel editor values', () => {
  beforeEach(async () => {
    vi.resetAllMocks();
    vi.resetModules();
    await rm(testHome, { recursive: true, force: true });
    await rm(testUserData, { recursive: true, force: true });
  });

  it('reads plugin-backed boolean and array values for the workbench editor', async () => {
    const { saveChannelConfig, getChannelEditorValues } = await import('@electron/utils/channel-config');

    await saveChannelConfig(
      'wecom',
      {
        botId: 'ww-test',
        secret: 'secret',
        mode: 'ws',
        requireMention: true,
        allowFrom: ['alice', 'bob'],
      },
      'default',
    );

    await expect(getChannelEditorValues('wecom', 'default')).resolves.toEqual(
      expect.objectContaining({
        botId: 'ww-test',
        secret: 'secret',
        mode: 'ws',
        requireMention: true,
        dmPolicy: 'open',
        allowFrom: ['alice', 'bob', '*'],
      }),
    );
  });

  it('keeps telegram allowedUsers mapped for the editor view', async () => {
    const { saveChannelConfig, getChannelEditorValues } = await import('@electron/utils/channel-config');

    await saveChannelConfig(
      'telegram',
      {
        botToken: 'telegram-token',
        allowedUsers: '123, 456',
      },
      'default',
    );

    await expect(getChannelEditorValues('telegram', 'default')).resolves.toEqual(
      expect.objectContaining({
        botToken: 'telegram-token',
        allowedUsers: '123, 456',
      }),
    );
  });
});

describe('channel account rename', () => {
  beforeEach(async () => {
    vi.resetAllMocks();
    vi.resetModules();
    await rm(testHome, { recursive: true, force: true });
    await rm(testUserData, { recursive: true, force: true });
  });

  it('renames an account id, preserves the default pointer, and keeps mirrored top-level config in sync', async () => {
    const { renameChannelAccountConfig, saveChannelConfig } = await import('@electron/utils/channel-config');

    await saveChannelConfig('feishu', { appId: 'bot-default', appSecret: 'secret' }, 'default');

    await renameChannelAccountConfig('feishu', 'default', 'sales-bot');

    const config = await readOpenClawJson();
    const channels = config.channels as Record<string, {
      appId?: string;
      defaultAccount?: string;
      accounts: Record<string, { appId?: string }>;
    }>;

    expect(channels.feishu.defaultAccount).toBe('sales-bot');
    expect(channels.feishu.accounts.default).toBeUndefined();
    expect(channels.feishu.accounts['sales-bot']).toEqual(
      expect.objectContaining({ appId: 'bot-default' }),
    );
    expect(channels.feishu.appId).toBe('bot-default');
  });
});

describe('channel recipient hint values', () => {
  beforeEach(async () => {
    vi.resetAllMocks();
    vi.resetModules();
    await rm(testHome, { recursive: true, force: true });
    await rm(testUserData, { recursive: true, force: true });
  });

  it('merges feishu pairing-store allowFrom into recipient hints', async () => {
    const { saveChannelConfig, getChannelRecipientHintValues } = await import('@electron/utils/channel-config');

    await saveChannelConfig('feishu', { appId: 'bot-app', appSecret: 'bot-secret', allowFrom: ['*'] }, 'bot2');
    const credentialsDir = join(testHome, '.openclaw', 'credentials');
    await mkdir(credentialsDir, { recursive: true });
    await writeFile(
      join(credentialsDir, 'feishu-bot2-allowFrom.json'),
      JSON.stringify({ version: 1, allowFrom: ['ou_123'] }, null, 2),
      'utf8',
    );

    await expect(getChannelRecipientHintValues('feishu', 'bot2')).resolves.toEqual(
      {
        reason: 'derived',
        recipientId: 'ou_123',
      },
    );
  });

  it('merges telegram default pairing-store allowFrom into recipient hints', async () => {
    const { saveChannelConfig, getChannelRecipientHintValues } = await import('@electron/utils/channel-config');

    await saveChannelConfig('telegram', { botToken: 'telegram-token' }, 'default');
    const credentialsDir = join(testHome, '.openclaw', 'credentials');
    await mkdir(credentialsDir, { recursive: true });
    await writeFile(
      join(credentialsDir, 'telegram-default-allowFrom.json'),
      JSON.stringify({ version: 1, allowFrom: ['5937398060'] }, null, 2),
      'utf8',
    );
    await writeFile(
      join(credentialsDir, 'telegram-allowFrom.json'),
      JSON.stringify({ version: 1, allowFrom: ['5937398060'] }, null, 2),
      'utf8',
    );

    await expect(getChannelRecipientHintValues('telegram', 'default')).resolves.toEqual(
      {
        reason: 'derived',
        recipientId: '5937398060',
      },
    );
  });
});
