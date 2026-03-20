import type { IncomingMessage, ServerResponse } from 'http';
import {
  deleteChannelAccountConfig,
  deleteChannelConfig,
  getChannelEditorValues,
  getChannelFormValues,
  listConfiguredChannelAccounts,
  listConfiguredChannels,
  readOpenClawConfig,
  renameChannelAccountConfig,
  saveChannelConfig,
  setChannelDefaultAccount,
  setChannelEnabled,
  validateChannelConfig,
  validateChannelCredentials,
} from '../../utils/channel-config';
import {
  assignChannelAccountToAgent,
  clearAllBindingsForChannel,
  clearChannelBinding,
  listAgentsSnapshot,
  renameChannelAccountBinding,
} from '../../utils/agent-config';
import {
  ensureDingTalkPluginInstalled,
  ensureFeishuPluginInstalled,
  ensureQQBotPluginInstalled,
  ensureWeComPluginInstalled,
} from '../../utils/plugin-install';
import {
  computeChannelRuntimeStatus,
  pickChannelRuntimeStatus,
  type ChannelRuntimeAccountSnapshot,
} from '../../../src/lib/channel-status';
import { whatsAppLoginManager } from '../../utils/whatsapp-login';
import type { HostApiContext } from '../context';
import { parseJsonBody, sendJson } from '../route-utils';

function scheduleGatewayChannelRestart(ctx: HostApiContext, reason: string): void {
  void ctx.gatewayRuntimeController.requestRuntimeRefresh({ mode: 'restart' });
  void reason;
}

// Keep reload-first for feishu to avoid restart storms when channel auth/network is flaky.
// GatewayManager.reload() already falls back to restart when reload is unhealthy.
const FORCE_RESTART_CHANNELS = new Set(['dingtalk', 'wecom', 'whatsapp']);

function scheduleGatewayChannelSaveRefresh(
  ctx: HostApiContext,
  channelType: string,
  reason: string,
): void {
  if (FORCE_RESTART_CHANNELS.has(channelType)) {
    void ctx.gatewayRuntimeController.requestRuntimeRefresh({ mode: 'restart' });
    void reason;
    return;
  }
  void ctx.gatewayRuntimeController.requestRuntimeRefresh({ mode: 'reload' });
  void reason;
}

function toComparableConfig(input: Record<string, unknown>): Record<string, string> {
  const next: Record<string, string> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || value === null) continue;
    if (typeof value === 'string') {
      next[key] = value.trim();
      continue;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      next[key] = String(value);
      continue;
    }
    if (Array.isArray(value) && value.every((item) => typeof item === 'string')) {
      next[key] = value.map((item) => item.trim()).join('\n');
    }
  }
  return next;
}

function isSameConfigValues(
  existing: Record<string, unknown> | undefined,
  incoming: Record<string, unknown>,
): boolean {
  if (!existing) return false;
  const current = toComparableConfig(existing);
  const next = toComparableConfig(incoming);
  const keys = new Set([...Object.keys(current), ...Object.keys(next)]);
  if (keys.size === 0) return false;
  for (const key of keys) {
    if ((current[key] ?? '') !== (next[key] ?? '')) {
      return false;
    }
  }
  return true;
}

async function ensureScopedChannelBinding(channelType: string, accountId?: string): Promise<void> {
  // Multi-agent safety: only bind when the caller explicitly scopes the account.
  // Global channel saves (no accountId) must not override routing to "main".
  if (!accountId) return;
  const agents = await listAgentsSnapshot();
  if (!agents.entries || agents.entries.length === 0) return;

  // Keep backward compatibility for the legacy default account.
  if (accountId === 'default') {
    if (agents.entries.some((entry) => entry.id === 'main')) {
      await assignChannelAccountToAgent('main', channelType, 'default');
    }
    return;
  }

  // Legacy compatibility: if accountId matches an existing agentId, keep auto-binding.
  if (agents.entries.some((entry) => entry.id === accountId)) {
    await assignChannelAccountToAgent(accountId, channelType, accountId);
  }
}

interface GatewayChannelStatusPayload {
  channelOrder?: string[];
  channels?: Record<string, unknown>;
  channelAccounts?: Record<string, Array<{
    accountId?: string;
    configured?: boolean;
    connected?: boolean;
    running?: boolean;
    lastError?: string;
    name?: string;
    linked?: boolean;
    lastConnectedAt?: number | null;
    lastInboundAt?: number | null;
    lastOutboundAt?: number | null;
    lastProbeAt?: number | null;
    probe?: {
      ok?: boolean;
    } | null;
  }>>;
  channelDefaultAccountId?: Record<string, string>;
}

interface ChannelAccountView {
  accountId: string;
  name: string;
  configured: boolean;
  connected: boolean;
  running: boolean;
  linked: boolean;
  enabled: boolean;
  lastError?: string;
  status: 'connected' | 'connecting' | 'disconnected' | 'error';
  isDefault: boolean;
  agentId?: string;
}

interface ChannelAccountsView {
  channelType: string;
  defaultAccountId: string;
  enabled: boolean;
  status: 'connected' | 'connecting' | 'disconnected' | 'error';
  accounts: ChannelAccountView[];
}

interface ChannelAccountsPayload {
  channels: ChannelAccountsView[];
  runtimeAvailable: boolean;
  gatewayState: string;
}

async function buildChannelAccountsView(ctx: HostApiContext, shouldProbe = false): Promise<ChannelAccountsPayload> {
  const [configuredChannels, configuredAccounts, openClawConfig, agentsSnapshot] = await Promise.all([
    listConfiguredChannels(),
    listConfiguredChannelAccounts(),
    readOpenClawConfig(),
    listAgentsSnapshot(),
  ]);

  const gatewayState = ctx.gatewayManager.getStatus().state;
  let gatewayStatus: GatewayChannelStatusPayload | null;
  if (gatewayState === 'running') {
    try {
      gatewayStatus = await ctx.gatewayManager.rpc<GatewayChannelStatusPayload>('channels.status', { probe: shouldProbe });
    } catch {
      gatewayStatus = null;
    }
  } else {
    gatewayStatus = null;
  }

  const channelTypes = new Set<string>([
    ...configuredChannels,
    ...Object.keys(configuredAccounts),
    ...Object.keys(gatewayStatus?.channelAccounts || {}),
  ]);

  const channels: ChannelAccountsView[] = [];
  for (const channelType of channelTypes) {
    const channelAccountsFromConfig = configuredAccounts[channelType]?.accountIds ?? [];
    const hasLocalConfig = configuredChannels.includes(channelType) || Boolean(configuredAccounts[channelType]);
    const channelSection = openClawConfig.channels?.[channelType];
    const channelSummary =
      (gatewayStatus?.channels?.[channelType] as { error?: string; lastError?: string } | undefined) ?? undefined;
    const fallbackDefault =
      typeof channelSection?.defaultAccount === 'string' && channelSection.defaultAccount.trim()
        ? channelSection.defaultAccount
        : 'default';
    const enabled =
      channelType === 'whatsapp'
        ? openClawConfig.plugins?.entries?.[channelType]?.enabled !== false
        : channelSection?.enabled !== false;
    const defaultAccountId = configuredAccounts[channelType]?.defaultAccountId
      ?? gatewayStatus?.channelDefaultAccountId?.[channelType]
      ?? fallbackDefault;
    const runtimeAccounts = gatewayStatus?.channelAccounts?.[channelType] ?? [];
    const hasRuntimeConfigured = runtimeAccounts.some((account) => account.configured === true);
    if (!hasLocalConfig && !hasRuntimeConfigured) {
      continue;
    }
    const runtimeAccountIds = runtimeAccounts
      .map((account) => account.accountId)
      .filter((accountId): accountId is string => typeof accountId === 'string' && accountId.trim().length > 0);
    const accountIds = Array.from(new Set([...channelAccountsFromConfig, ...runtimeAccountIds, defaultAccountId]));

    const accounts: ChannelAccountView[] = accountIds.map((accountId) => {
      const runtime = runtimeAccounts.find((item) => item.accountId === accountId);
      const runtimeSnapshot: ChannelRuntimeAccountSnapshot = runtime ?? {};
      const status = computeChannelRuntimeStatus(runtimeSnapshot);
      return {
        accountId,
        name: runtime?.name || accountId,
        configured: channelAccountsFromConfig.includes(accountId) || runtime?.configured === true,
        connected: runtime?.connected === true,
        running: runtime?.running === true,
        linked: runtime?.linked === true,
        enabled,
        lastError: typeof runtime?.lastError === 'string' ? runtime.lastError : undefined,
        status,
        isDefault: accountId === defaultAccountId,
        agentId: agentsSnapshot.channelAccountOwners[`${channelType}:${accountId}`],
      };
    }).sort((left, right) => {
      if (left.accountId === defaultAccountId) return -1;
      if (right.accountId === defaultAccountId) return 1;
      return left.accountId.localeCompare(right.accountId);
    });

    channels.push({
      channelType,
      defaultAccountId,
      enabled,
      status: pickChannelRuntimeStatus(runtimeAccounts, channelSummary),
      accounts,
    });
  }

  return {
    channels: channels.sort((left, right) => left.channelType.localeCompare(right.channelType)),
    runtimeAvailable: gatewayStatus !== null,
    gatewayState,
  };
}

export async function handleChannelRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  ctx: HostApiContext,
): Promise<boolean> {
  if (url.pathname === '/api/channels/configured' && req.method === 'GET') {
    sendJson(res, 200, { success: true, channels: await listConfiguredChannels() });
    return true;
  }

  if (url.pathname === '/api/channels/accounts' && req.method === 'GET') {
    try {
      const payload = await buildChannelAccountsView(ctx, url.searchParams.get('probe') === '1');
      sendJson(res, 200, { success: true, ...payload });
    } catch (error) {
      sendJson(res, 500, { success: false, error: String(error) });
    }
    return true;
  }

  if (url.pathname === '/api/channels/default-account' && req.method === 'PUT') {
    try {
      const body = await parseJsonBody<{ channelType: string; accountId: string }>(req);
      await setChannelDefaultAccount(body.channelType, body.accountId);
      scheduleGatewayChannelSaveRefresh(ctx, body.channelType, `channel:setDefaultAccount:${body.channelType}`);
      sendJson(res, 200, { success: true });
    } catch (error) {
      sendJson(res, 500, { success: false, error: String(error) });
    }
    return true;
  }

  if (url.pathname === '/api/channels/binding' && req.method === 'PUT') {
    try {
      const body = await parseJsonBody<{ channelType: string; accountId: string; agentId: string }>(req);
      await assignChannelAccountToAgent(body.agentId, body.channelType, body.accountId);
      scheduleGatewayChannelSaveRefresh(ctx, body.channelType, `channel:setBinding:${body.channelType}`);
      sendJson(res, 200, { success: true });
    } catch (error) {
      sendJson(res, 500, { success: false, error: String(error) });
    }
    return true;
  }

  if (url.pathname === '/api/channels/binding' && req.method === 'DELETE') {
    try {
      const body = await parseJsonBody<{ channelType: string; accountId: string }>(req);
      await clearChannelBinding(body.channelType, body.accountId);
      scheduleGatewayChannelSaveRefresh(ctx, body.channelType, `channel:clearBinding:${body.channelType}`);
      sendJson(res, 200, { success: true });
    } catch (error) {
      sendJson(res, 500, { success: false, error: String(error) });
    }
    return true;
  }

  if (url.pathname === '/api/channels/account-id/rename' && req.method === 'PUT') {
    try {
      const body = await parseJsonBody<{ channelType: string; accountId: string; nextAccountId: string }>(req);
      await renameChannelAccountConfig(body.channelType, body.accountId, body.nextAccountId);
      await renameChannelAccountBinding(body.channelType, body.accountId, body.nextAccountId);
      scheduleGatewayChannelSaveRefresh(ctx, body.channelType, `channel:renameAccount:${body.channelType}`);
      sendJson(res, 200, { success: true, accountId: body.nextAccountId.trim() });
    } catch (error) {
      sendJson(res, 500, { success: false, error: String(error) });
    }
    return true;
  }

  if (url.pathname === '/api/channels/config/validate' && req.method === 'POST') {
    try {
      const body = await parseJsonBody<{ channelType: string }>(req);
      sendJson(res, 200, { success: true, ...(await validateChannelConfig(body.channelType)) });
    } catch (error) {
      sendJson(res, 500, { success: false, valid: false, errors: [String(error)], warnings: [] });
    }
    return true;
  }

  if (url.pathname === '/api/channels/credentials/validate' && req.method === 'POST') {
    try {
      const body = await parseJsonBody<{ channelType: string; config: Record<string, string> }>(req);
      sendJson(res, 200, { success: true, ...(await validateChannelCredentials(body.channelType, body.config)) });
    } catch (error) {
      sendJson(res, 500, { success: false, valid: false, errors: [String(error)], warnings: [] });
    }
    return true;
  }

  if (url.pathname === '/api/channels/whatsapp/start' && req.method === 'POST') {
    try {
      const body = await parseJsonBody<{ accountId: string }>(req);
      await whatsAppLoginManager.start(body.accountId);
      sendJson(res, 200, { success: true });
    } catch (error) {
      sendJson(res, 500, { success: false, error: String(error) });
    }
    return true;
  }

  if (url.pathname === '/api/channels/whatsapp/cancel' && req.method === 'POST') {
    try {
      await whatsAppLoginManager.stop();
      sendJson(res, 200, { success: true });
    } catch (error) {
      sendJson(res, 500, { success: false, error: String(error) });
    }
    return true;
  }

  if (url.pathname === '/api/channels/config' && req.method === 'POST') {
    try {
      const body = await parseJsonBody<{ channelType: string; config: Record<string, unknown>; accountId?: string }>(req);
      if (body.channelType === 'dingtalk') {
        const installResult = await ensureDingTalkPluginInstalled();
        if (!installResult.installed) {
          sendJson(res, 500, { success: false, error: installResult.warning || 'DingTalk plugin install failed' });
          return true;
        }
      }
      if (body.channelType === 'wecom') {
        const installResult = await ensureWeComPluginInstalled();
        if (!installResult.installed) {
          sendJson(res, 500, { success: false, error: installResult.warning || 'WeCom plugin install failed' });
          return true;
        }
      }
      if (body.channelType === 'qqbot') {
        const installResult = await ensureQQBotPluginInstalled();
        if (!installResult.installed) {
          sendJson(res, 500, { success: false, error: installResult.warning || 'QQ Bot plugin install failed' });
          return true;
        }
      }
      if (body.channelType === 'feishu') {
        const installResult = await ensureFeishuPluginInstalled();
        if (!installResult.installed) {
          sendJson(res, 500, { success: false, error: installResult.warning || 'Feishu plugin install failed' });
          return true;
        }
      }
      const existingValues = await getChannelEditorValues(body.channelType, body.accountId);
      if (isSameConfigValues(existingValues, body.config)) {
        await ensureScopedChannelBinding(body.channelType, body.accountId);
        sendJson(res, 200, { success: true, noChange: true });
        return true;
      }
      await saveChannelConfig(body.channelType, body.config, body.accountId);
      await ensureScopedChannelBinding(body.channelType, body.accountId);
      scheduleGatewayChannelSaveRefresh(ctx, body.channelType, `channel:saveConfig:${body.channelType}`);
      sendJson(res, 200, { success: true });
    } catch (error) {
      sendJson(res, 500, { success: false, error: String(error) });
    }
    return true;
  }

  if (url.pathname === '/api/channels/config/enabled' && req.method === 'PUT') {
    try {
      const body = await parseJsonBody<{ channelType: string; enabled: boolean }>(req);
      await setChannelEnabled(body.channelType, body.enabled);
      scheduleGatewayChannelRestart(ctx, `channel:setEnabled:${body.channelType}`);
      sendJson(res, 200, { success: true });
    } catch (error) {
      sendJson(res, 500, { success: false, error: String(error) });
    }
    return true;
  }

  if (url.pathname.startsWith('/api/channels/config-editor/') && req.method === 'GET') {
    try {
      const channelType = decodeURIComponent(url.pathname.slice('/api/channels/config-editor/'.length));
      const accountId = url.searchParams.get('accountId') || undefined;
      sendJson(res, 200, {
        success: true,
        values: await getChannelEditorValues(channelType, accountId),
      });
    } catch (error) {
      sendJson(res, 500, { success: false, error: String(error) });
    }
    return true;
  }

  if (url.pathname.startsWith('/api/channels/config/') && req.method === 'GET') {
    try {
      const channelType = decodeURIComponent(url.pathname.slice('/api/channels/config/'.length));
      const accountId = url.searchParams.get('accountId') || undefined;
      sendJson(res, 200, {
        success: true,
        values: await getChannelFormValues(channelType, accountId),
      });
    } catch (error) {
      sendJson(res, 500, { success: false, error: String(error) });
    }
    return true;
  }

  if (url.pathname.startsWith('/api/channels/config/') && req.method === 'DELETE') {
    try {
      const channelType = decodeURIComponent(url.pathname.slice('/api/channels/config/'.length));
      const accountId = url.searchParams.get('accountId') || undefined;
      if (accountId) {
        await deleteChannelAccountConfig(channelType, accountId);
        await clearChannelBinding(channelType, accountId);
        scheduleGatewayChannelSaveRefresh(ctx, channelType, `channel:deleteAccount:${channelType}`);
      } else {
        await deleteChannelConfig(channelType);
        await clearAllBindingsForChannel(channelType);
        scheduleGatewayChannelRestart(ctx, `channel:deleteConfig:${channelType}`);
      }
      sendJson(res, 200, { success: true });
    } catch (error) {
      sendJson(res, 500, { success: false, error: String(error) });
    }
    return true;
  }

  void ctx;
  return false;
}
