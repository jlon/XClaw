import { PORTS } from '../utils/config';
import { getSetting } from '../utils/store';
import type { GatewayManager, GatewayStatus } from './manager';

type GatewayManagerPortController = Pick<GatewayManager, 'getStatus' | 'restart' | 'setPort'>;

type ApplyGatewaySettingsRuntimeEffectsOptions = {
  gatewayManager: GatewayManagerPortController;
  gatewayPort?: unknown;
  applyProxySettings?: (() => Promise<void>) | null;
  applyLaunchAtStartup?: (() => Promise<void>) | null;
};

function parseGatewayPort(value: unknown): number | null {
  return typeof value === 'number'
    && Number.isInteger(value)
    && value >= 1
    && value <= 65535
    ? value
    : null;
}

export function normalizeGatewayPort(value: unknown): number {
  const port = parseGatewayPort(value);
  if (port === null) {
    throw new Error(`Invalid gateway port: ${String(value)}`);
  }
  return port;
}

export async function resolveRuntimeGatewayPort(status: Pick<GatewayStatus, 'port'>): Promise<number> {
  const statusPort = parseGatewayPort(status.port);
  if (statusPort !== null) {
    return statusPort;
  }

  const configuredPort = parseGatewayPort(await getSetting('gatewayPort'));
  return configuredPort ?? PORTS.OPENCLAW_GATEWAY;
}

export async function applyGatewaySettingsRuntimeEffects(
  options: ApplyGatewaySettingsRuntimeEffectsOptions,
): Promise<void> {
  const { gatewayManager, gatewayPort, applyProxySettings, applyLaunchAtStartup } = options;
  const status = gatewayManager.getStatus();
  let shouldRestart = status.state === 'running' && Boolean(applyProxySettings);

  if (gatewayPort !== undefined) {
    const nextPort = normalizeGatewayPort(gatewayPort);
    if (status.port !== nextPort) {
      gatewayManager.setPort(nextPort);
      shouldRestart = shouldRestart || status.state === 'running';
    }
  }

  if (applyProxySettings) {
    await applyProxySettings();
  }

  if (applyLaunchAtStartup) {
    await applyLaunchAtStartup();
  }

  if (shouldRestart) {
    await gatewayManager.restart();
  }
}
