import type { IncomingMessage, ServerResponse } from 'http';
import { applyProxySettings } from '../../main/proxy';
import { syncLaunchAtStartupSettingFromStore } from '../../main/launch-at-startup';
import { getAllSettings, getSetting, resetSettings, setSetting, type AppSettings } from '../../utils/store';
import type { HostApiContext } from '../context';
import { parseJsonBody, sendJson } from '../route-utils';

function patchTouchesProxy(patch: Partial<AppSettings>): boolean {
  return Object.keys(patch).some((key) => (
    key === 'proxyEnabled' ||
    key === 'proxyServer' ||
    key === 'proxyHttpServer' ||
    key === 'proxyHttpsServer' ||
    key === 'proxyAllServer' ||
    key === 'proxyBypassRules'
  ));
}

function patchTouchesLaunchAtStartup(patch: Partial<AppSettings>): boolean {
  return Object.prototype.hasOwnProperty.call(patch, 'launchAtStartup');
}

function patchTouchesGatewayPort(patch: Partial<AppSettings>): boolean {
  return Object.prototype.hasOwnProperty.call(patch, 'gatewayPort');
}

export async function handleSettingsRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  ctx: HostApiContext,
): Promise<boolean> {
  if (url.pathname === '/api/settings' && req.method === 'GET') {
    sendJson(res, 200, await getAllSettings());
    return true;
  }

  if (url.pathname === '/api/settings' && req.method === 'PUT') {
    try {
      const patch = await parseJsonBody<Partial<AppSettings>>(req);
      const entries = Object.entries(patch) as Array<[keyof AppSettings, AppSettings[keyof AppSettings]]>;
      for (const [key, value] of entries) {
        await setSetting(key, value);
      }
      const settings = patchTouchesProxy(patch) ? await getAllSettings() : null;
      await ctx.gatewayRuntimeController.applySettingsRuntimeEffects({
        gatewayPort: patchTouchesGatewayPort(patch) ? patch.gatewayPort : undefined,
        applyProxySettings: settings ? async () => applyProxySettings(settings) : null,
        applyLaunchAtStartup: patchTouchesLaunchAtStartup(patch) ? syncLaunchAtStartupSettingFromStore : null,
      });
      sendJson(res, 200, { success: true });
    } catch (error) {
      sendJson(res, 500, { success: false, error: String(error) });
    }
    return true;
  }

  if (url.pathname.startsWith('/api/settings/') && req.method === 'GET') {
    const key = url.pathname.slice('/api/settings/'.length) as keyof AppSettings;
    try {
      sendJson(res, 200, { value: await getSetting(key) });
    } catch (error) {
      sendJson(res, 404, { success: false, error: String(error) });
    }
    return true;
  }

  if (url.pathname.startsWith('/api/settings/') && req.method === 'PUT') {
    const key = url.pathname.slice('/api/settings/'.length) as keyof AppSettings;
    try {
      const body = await parseJsonBody<{ value: AppSettings[keyof AppSettings] }>(req);
      await setSetting(key, body.value);
      const touchesProxy = patchTouchesProxy({ [key]: body.value } as Partial<AppSettings>);
      const settings = touchesProxy ? await getAllSettings() : null;
      await ctx.gatewayRuntimeController.applySettingsRuntimeEffects({
        gatewayPort: key === 'gatewayPort' ? body.value : undefined,
        applyProxySettings: settings ? async () => applyProxySettings(settings) : null,
        applyLaunchAtStartup: key === 'launchAtStartup' ? syncLaunchAtStartupSettingFromStore : null,
      });
      sendJson(res, 200, { success: true });
    } catch (error) {
      sendJson(res, 500, { success: false, error: String(error) });
    }
    return true;
  }

  if (url.pathname === '/api/settings/reset' && req.method === 'POST') {
    try {
      await resetSettings();
      const settings = await getAllSettings();
      await ctx.gatewayRuntimeController.applySettingsRuntimeEffects({
        gatewayPort: settings.gatewayPort,
        applyProxySettings: async () => applyProxySettings(settings),
        applyLaunchAtStartup: syncLaunchAtStartupSettingFromStore,
      });
      sendJson(res, 200, { success: true, settings });
    } catch (error) {
      sendJson(res, 500, { success: false, error: String(error) });
    }
    return true;
  }

  return false;
}
