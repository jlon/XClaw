import { getSetting, setSetting, type GatewayDesiredState, type GatewayManagedMode } from '../utils/store';
import { normalizeGatewayPort } from './runtime-config';
import type { GatewayManager } from './manager';

export type GatewayOwnership = 'managed' | 'adopted' | 'detached';

type GatewayManagerController = Pick<
  GatewayManager,
  'debouncedReload' | 'debouncedRestart' | 'getStatus' | 'replaceRuntime' | 'restart' | 'setPort' | 'start' | 'stop'
> & {
  ownsCurrentProcess?: () => boolean;
};

type GatewayRuntimeControllerOptions = {
  gatewayManager: GatewayManagerController;
};

export type GatewayRuntimeState = {
  desiredState: GatewayDesiredState;
  managedMode: GatewayManagedMode;
  ownership: GatewayOwnership;
  recoveryInFlight: boolean;
  suppressAutoRecoverUntil?: number;
};

type GatewayRuntimeRefreshOptions = {
  mode?: 'reload' | 'restart';
  delayMs?: number;
};

type GatewaySettingsRuntimeEffectsOptions = {
  gatewayPort?: unknown;
  applyProxySettings?: (() => Promise<void>) | null;
  applyLaunchAtStartup?: (() => Promise<void>) | null;
};

function resolveDesiredState(value: unknown): GatewayDesiredState {
  return value === 'stopped' ? 'stopped' : 'running';
}

function resolveManagedMode(value: unknown): GatewayManagedMode {
  return value === 'managed' ? 'managed' : 'unmanaged';
}

export class GatewayRuntimeController {
  private desiredState: GatewayDesiredState = 'running';
  private managedMode: GatewayManagedMode = 'unmanaged';
  private ownership: GatewayOwnership = 'detached';
  private recoveryInFlight = false;
  private suppressAutoRecoverUntil?: number;

  constructor(private readonly options: GatewayRuntimeControllerOptions) {}

  async bootstrap(): Promise<void> {
    await this.loadPersistedState();
    if (!this.shouldAutoRecover()) {
      return;
    }
    await this.ensureRunning();
  }

  getRuntimeState(): GatewayRuntimeState {
    return {
      desiredState: this.desiredState,
      managedMode: this.managedMode,
      ownership: this.ownership,
      recoveryInFlight: this.recoveryInFlight,
      suppressAutoRecoverUntil: this.suppressAutoRecoverUntil,
    };
  }

  shouldAutoRecover(now = Date.now()): boolean {
    if (this.managedMode !== 'managed' || this.desiredState !== 'running') {
      return false;
    }
    if (this.recoveryInFlight) {
      return false;
    }
    return !this.suppressAutoRecoverUntil || this.suppressAutoRecoverUntil <= now;
  }

  async requestStart(): Promise<void> {
    await this.activateManagedMode('running');
  }

  async requestStop(): Promise<void> {
    await setSetting('gatewayDesiredState', 'stopped');
    this.desiredState = 'stopped';
    this.recoveryInFlight = false;
    this.suppressAutoRecoverUntil = undefined;
    await this.options.gatewayManager.stop();
    this.ownership = 'detached';
  }

  async requestRestart(): Promise<void> {
    await this.activateManagedMode('running');
    if (this.options.gatewayManager.getStatus().state === 'stopped') {
      return;
    }
    await this.options.gatewayManager.restart();
    this.ownership = 'managed';
  }

  async applySettingsRuntimeEffects(options: GatewaySettingsRuntimeEffectsOptions): Promise<void> {
    await this.loadPersistedState();
    const { gatewayPort, applyProxySettings, applyLaunchAtStartup } = options;
    const status = this.options.gatewayManager.getStatus();
    let shouldRestart = status.state === 'running' && Boolean(applyProxySettings);

    if (gatewayPort !== undefined) {
      const nextPort = normalizeGatewayPort(gatewayPort);
      if (status.port !== nextPort) {
        this.options.gatewayManager.setPort(nextPort);
        shouldRestart = shouldRestart || status.state === 'running';
      }
    }

    if (applyProxySettings) {
      await applyProxySettings();
    }

    if (applyLaunchAtStartup) {
      await applyLaunchAtStartup();
    }

    if (!shouldRestart || this.desiredState === 'stopped') {
      return;
    }

    await this.restartRuntime();
  }

  async requestRuntimeRefresh(options: GatewayRuntimeRefreshOptions = {}): Promise<void> {
    await this.loadPersistedState();
    if (this.desiredState === 'stopped') {
      return;
    }

    if (this.options.gatewayManager.getStatus().state === 'stopped') {
      return;
    }

    if (options.mode === 'restart') {
      this.options.gatewayManager.debouncedRestart(options.delayMs);
      return;
    }

    this.options.gatewayManager.debouncedReload(options.delayMs);
  }

  async restartRuntime(): Promise<void> {
    await this.loadPersistedState();
    if (this.desiredState === 'stopped') {
      return;
    }

    if (this.options.gatewayManager.getStatus().state === 'stopped') {
      return;
    }

    await this.options.gatewayManager.restart();
    if (this.managedMode === 'managed') {
      this.ownership = 'managed';
    }
  }

  async replaceRuntime(): Promise<void> {
    await this.loadPersistedState();
    if (this.desiredState === 'stopped') {
      return;
    }

    if (this.options.gatewayManager.getStatus().state === 'stopped') {
      return;
    }

    await this.options.gatewayManager.replaceRuntime();
    if (this.managedMode === 'managed') {
      this.ownership = 'managed';
    }
  }

  async activateManagedMode(desiredState: GatewayDesiredState): Promise<void> {
    await setSetting('gatewayManagedMode', 'managed');
    await setSetting('gatewayDesiredState', desiredState);
    this.managedMode = 'managed';
    this.desiredState = desiredState;
    if (desiredState === 'running') {
      await this.ensureRunning();
    }
  }

  private async loadPersistedState(): Promise<void> {
    const [managedMode, desiredState] = await Promise.all([
      getSetting('gatewayManagedMode'),
      getSetting('gatewayDesiredState'),
    ]);
    this.managedMode = resolveManagedMode(managedMode);
    this.desiredState = resolveDesiredState(desiredState);
  }

  private async ensureRunning(): Promise<void> {
    if (!this.shouldAutoRecover()) {
      return;
    }
    this.recoveryInFlight = true;
    try {
      await this.options.gatewayManager.start();
      this.ownership = this.options.gatewayManager.ownsCurrentProcess?.() === false ? 'adopted' : 'managed';
    } finally {
      this.recoveryInFlight = false;
    }
  }
}
