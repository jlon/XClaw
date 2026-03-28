/**
 * Gateway Process Manager
 * Manages the OpenClaw Gateway process lifecycle
 */
import { app } from 'electron';
import path from 'path';
import { EventEmitter } from 'events';
import WebSocket from 'ws';
import { PORTS } from '../utils/config';
import { JsonRpcNotification, isNotification, isResponse } from './protocol';
import { logger } from '../utils/logger';
import { captureTelemetryEvent, trackMetric } from '../utils/telemetry';
import {
  loadOrCreateDeviceIdentity,
  type DeviceIdentity,
} from '../utils/device-identity';
import {
  DEFAULT_RECONNECT_CONFIG,
  type ReconnectConfig,
  type GatewayLifecycleState,
  getReconnectScheduleDecision,
  getReconnectSkipReason,
} from './process-policy';
import {
  clearPendingGatewayRequests,
  rejectPendingGatewayRequest,
  resolvePendingGatewayRequest,
  type PendingGatewayRequest,
} from './request-store';
import { dispatchJsonRpcNotification, dispatchProtocolEvent } from './event-dispatch';
import { GatewayStateController } from './state';
import { prepareGatewayLaunchContext } from './config-sync';
import { connectGatewaySocket, waitForGatewayReady } from './ws-client';
import {
  findExistingGatewayProcess,
  runOpenClawDoctorRepair,
  terminateGatewayProcessesListeningOnPort,
  terminateOwnedGatewayProcess,
  unloadLaunchctlGatewayService,
  waitForPortFree,
  warmupManagedPythonReadiness,
} from './supervisor';
import { findSuggestedGatewayPort, isLocalGatewayPortAvailable } from './port-utils';
import { GatewayConnectionMonitor } from './connection-monitor';
import { GatewayLifecycleController, LifecycleSupersededError } from './lifecycle-controller';
import { launchGatewayHandoffProcess, launchGatewayProcess } from './process-launcher';
import { GatewayRestartController } from './restart-controller';
import { GatewayRestartGovernor } from './restart-governor';
import {
  DEFAULT_GATEWAY_RELOAD_POLICY,
  loadGatewayReloadPolicy,
  type GatewayReloadPolicy,
} from './reload-policy';
import { classifyGatewayStderrMessage, recordGatewayStartupStderrLine } from './startup-stderr';
import { runGatewayStartupSequence } from './startup-orchestrator';
import { setSetting } from '../utils/store';

export interface GatewayStatus {
  state: GatewayLifecycleState;
  port: number;
  pid?: number;
  uptime?: number;
  error?: string;
  connectedAt?: number;
  version?: string;
  reconnectAttempts?: number;
}

interface GatewayHealthPayload {
  status?: string;
  uptime?: number;
  version?: string;
}

/**
 * Gateway Manager Events
 */
export interface GatewayManagerEvents {
  status: (status: GatewayStatus) => void;
  message: (message: unknown) => void;
  notification: (notification: JsonRpcNotification) => void;
  exit: (code: number | null) => void;
  error: (error: Error) => void;
  'channel:status': (data: { channelId: string; status: string }) => void;
  'chat:message': (data: { message: unknown }) => void;
}

export type GatewayRecoveryTrigger =
  | 'child-exit'
  | 'health-check'
  | 'ping-timeout'
  | 'reconnect-failure'
  | 'ws-close';

export type GatewayRecoveryAction = 'reconnect' | 'restart' | 'attach-existing';

export type GatewayRecoveryContext = {
  trigger: GatewayRecoveryTrigger;
  plannedAction: GatewayRecoveryAction;
  currentState: GatewayLifecycleState;
  ownsProcess: boolean;
  reconnectAttempts: number;
  error?: string;
};

type GatewayRecoveryArbiter = (context: GatewayRecoveryContext) => boolean | Promise<boolean>;
type GatewayStopReason = 'user' | 'restart' | 'replace' | 'quit';

/**
 * Gateway Manager
 * Handles starting, stopping, and communicating with the OpenClaw Gateway
 */
export class GatewayManager extends EventEmitter {
  private process: Electron.UtilityProcess | null = null;
  private processExitCode: number | null = null; // set by exit event, replaces exitCode/signalCode
  private ownsProcess = false;
  private ws: WebSocket | null = null;
  private status: GatewayStatus = { state: 'stopped', port: PORTS.OPENCLAW_GATEWAY };
  private readonly stateController: GatewayStateController;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private reconnectConfig: ReconnectConfig;
  private shouldReconnect = true;
  private startLock = false;
  private lastSpawnSummary: string | null = null;
  private recentStartupStderrLines: string[] = [];
  private pendingRequests: Map<string, PendingGatewayRequest> = new Map();
  private deviceIdentity: DeviceIdentity | null = null;
  private restartInFlight: Promise<void> | null = null;
  private readonly connectionMonitor = new GatewayConnectionMonitor();
  private readonly lifecycleController = new GatewayLifecycleController();
  private readonly restartController = new GatewayRestartController();
  private readonly restartGovernor = new GatewayRestartGovernor();
  private reloadDebounceTimer: NodeJS.Timeout | null = null;
  private reloadPolicy: GatewayReloadPolicy = { ...DEFAULT_GATEWAY_RELOAD_POLICY };
  private reloadPolicyLoadedAt = 0;
  private reloadPolicyRefreshPromise: Promise<void> | null = null;
  private externalShutdownSupported: boolean | null = null;
  private healthRpcSupported: boolean | null = null;
  private consecutiveHealthFailures = 0;
  private reconnectAttemptsTotal = 0;
  private reconnectSuccessTotal = 0;
  private recoveryArbiter: GatewayRecoveryArbiter | null = null;
  private stopGeneration = 0;
  private static readonly RELOAD_POLICY_REFRESH_MS = 15_000;
  public static readonly RESTART_COOLDOWN_MS = 5_000;
  private lastRestartAt = 0;

  constructor(config?: Partial<ReconnectConfig>) {
    super();
    this.stateController = new GatewayStateController({
      emitStatus: (status) => {
        this.status = status;
        this.emit('status', status);
      },
      onTransition: (previousState, nextState) => {
        if (nextState === 'running') {
          this.restartGovernor.onRunning();
        }
        this.restartController.flushDeferredRestart(
          `status:${previousState}->${nextState}`,
          {
            state: this.status.state,
            startLock: this.startLock,
            shouldReconnect: this.shouldReconnect,
          },
          () => {
            void this.restart().catch((error) => {
              logger.warn('Deferred Gateway restart failed:', error);
            });
          },
        );
      },
    });
    this.reconnectConfig = { ...DEFAULT_RECONNECT_CONFIG, ...config };
    // Device identity is loaded lazily in start() — not in the constructor —
    // so that async file I/O and key generation don't block module loading.
  }

  private async initDeviceIdentity(): Promise<void> {
    if (this.deviceIdentity) return; // already loaded
    try {
      const identityPath = path.join(app.getPath('userData'), 'XClaw-device-identity.json');
      this.deviceIdentity = await loadOrCreateDeviceIdentity(identityPath);
      logger.debug(`Device identity loaded (deviceId=${this.deviceIdentity.deviceId})`);
    } catch (err) {
      logger.warn('Failed to load device identity, scopes will be limited:', err);
    }
  }

  private sanitizeSpawnArgs(args: string[]): string[] {
    const sanitized = [...args];
    const tokenIdx = sanitized.indexOf('--token');
    if (tokenIdx !== -1 && tokenIdx + 1 < sanitized.length) {
      sanitized[tokenIdx + 1] = '[redacted]';
    }
    return sanitized;
  }

  private isUnsupportedShutdownError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    return /unknown method:\s*shutdown/i.test(message);
  }

  private isUnsupportedHealthError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    return /unknown method:\s*system\.health/i.test(message);
  }

  private async persistResolvedGatewayPort(nextPort: number, reason: string): Promise<void> {
    if (this.status.port === nextPort) {
      return;
    }
    logger.warn(`Gateway port conflict detected (${reason}); switching XClaw managed runtime to ${nextPort}`);
    this.setPort(nextPort);
    await setSetting('gatewayPort', nextPort);
  }
  /**
   * Get current Gateway status
   */
  getStatus(): GatewayStatus {
    return this.stateController.getStatus();
  }

  /**
   * Check if Gateway is connected and ready
   */
  isConnected(): boolean {
    return this.stateController.isConnected(this.ws?.readyState === WebSocket.OPEN);
  }

  ownsCurrentProcess(): boolean {
    return this.ownsProcess;
  }

  setPort(port: number): void {
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new Error(`Invalid gateway port: ${String(port)}`);
    }

    if (this.getStatus().port === port) {
      return;
    }

    this.setStatus({ port });
  }

  setRecoveryArbiter(arbiter: GatewayRecoveryArbiter | null): void {
    this.recoveryArbiter = arbiter;
  }

  private shouldAbortRefresh(expectedStopGeneration: number, phase: string): boolean {
    if (this.stopGeneration === expectedStopGeneration) {
      return false;
    }
    logger.info(`Aborting Gateway refresh at ${phase} because stopGeneration changed`);
    return true;
  }

  /**
   * Start Gateway process
   */
  async start(): Promise<void> {
    if (this.startLock) {
      logger.debug('Gateway start ignored because a start flow is already in progress');
      return;
    }

    if (this.status.state === 'running') {
      logger.debug('Gateway already running, skipping start');
      return;
    }

    this.startLock = true;
    const startEpoch = this.lifecycleController.bump('start');
    logger.info(`Gateway start requested (port=${this.status.port})`);
    this.lastSpawnSummary = null;
    this.shouldReconnect = true;
    await this.refreshReloadPolicy(true);

    // Lazily load device identity (async file I/O + key generation).
    // Must happen before connect() which uses the identity for the handshake.
    await this.initDeviceIdentity();

    // Manual start should override and cancel any pending reconnect timer.
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
      logger.debug('Cleared pending reconnect timer because start was requested manually');
    }

    this.reconnectAttempts = 0;
    this.setStatus({ state: 'starting', reconnectAttempts: 0 });

    // Check if Python environment is ready (self-healing) asynchronously.
    // Fire-and-forget: only needs to run once, not on every retry.
    warmupManagedPythonReadiness();

    try {
      await runGatewayStartupSequence({
        port: this.status.port,
        ownedPid: this.process?.pid,
        shouldWaitForPortFree: process.platform === 'win32',
        resetStartupStderrLines: () => {
          this.recentStartupStderrLines = [];
        },
        getStartupStderrLines: () => this.recentStartupStderrLines,
        assertLifecycle: (phase) => {
          this.lifecycleController.assert(startEpoch, phase);
        },
        findExistingGateway: async (port, ownedPid) => {
          return await findExistingGatewayProcess({ port, ownedPid });
        },
        isPortAvailable: async (port) => {
          return await isLocalGatewayPortAvailable(port);
        },
        findSuggestedPort: async (preferredPort) => {
          return await findSuggestedGatewayPort(preferredPort);
        },
        onPortConflict: async (currentPort, suggestedPort, reason) => {
          await this.persistResolvedGatewayPort(
            suggestedPort,
            reason === 'external-auth-mismatch'
              ? `external gateway auth mismatch on ${currentPort}`
              : `listener already occupied on ${currentPort}`,
          );
        },
        connect: async (port, externalToken) => {
          await this.connect(port, externalToken);
        },
        onExistingGatewayConnectFailure: async (existing, error) => {
          if (!existing.owned) {
            const nextPort = await findSuggestedGatewayPort(existing.port);
            if (nextPort !== existing.port) {
              await this.persistResolvedGatewayPort(nextPort, `external gateway attach failure on ${existing.port}`);
              logger.warn(`Failed to attach external Gateway on port ${existing.port}; moving XClaw to ${nextPort}`, error);
              return { action: 'switch-port', port: nextPort } as const;
            }
            return { action: 'fail' } as const;
          }
          logger.warn(`Failed to attach existing owned Gateway on port ${existing.port}; replacing with managed process`, error);
          await terminateGatewayProcessesListeningOnPort(existing.port);
          return { action: 'replace-existing' } as const;
        },
        onConnectedToExistingGateway: (existing) => {
          const reattachedOwnedProcess = Boolean(existing.owned && existing.pid && this.process?.pid === existing.pid);
          this.ownsProcess = reattachedOwnedProcess;
          this.setStatus({ pid: reattachedOwnedProcess ? existing.pid : undefined });
          this.startHealthCheck();
        },
        waitForPortFree: async (port) => {
          await waitForPortFree(port);
        },
        startProcess: async () => {
          await this.startProcess();
        },
        waitForReady: async (port) => {
          await waitForGatewayReady({
            port,
            getProcessExitCode: () => this.processExitCode,
          });
        },
        onConnectedToManagedGateway: () => {
          this.startHealthCheck();
          logger.debug('Gateway started successfully');
        },
        runDoctorRepair: async () => await runOpenClawDoctorRepair(),
        onDoctorRepairSuccess: () => {
          this.setStatus({ state: 'starting', error: undefined, reconnectAttempts: 0 });
        },
        delay: async (ms) => {
          await new Promise((resolve) => setTimeout(resolve, ms));
        },
      });
    } catch (error) {
      if (error instanceof LifecycleSupersededError) {
        logger.debug(error.message);
        return;
      }
      logger.error(
        `Gateway start failed (port=${this.status.port}, reconnectAttempts=${this.reconnectAttempts}, spawn=${this.lastSpawnSummary ?? 'n/a'})`,
        error
      );
      this.setStatus({ state: 'error', error: String(error) });
      throw error;
    } finally {
      this.startLock = false;
      this.restartController.flushDeferredRestart(
        'start:finally',
        {
          state: this.status.state,
          startLock: this.startLock,
          shouldReconnect: this.shouldReconnect,
        },
        () => {
          void this.restart().catch((error) => {
            logger.warn('Deferred Gateway restart failed:', error);
          });
        },
      );
    }
  }

  /**
   * Stop Gateway process
   */
  async stop(options?: { shutdownExternal?: boolean; reason?: GatewayStopReason }): Promise<void> {
    logger.info('Gateway stop requested');
    this.lifecycleController.bump('stop');
    const reason = options?.reason ?? 'user';
    if (reason !== 'restart' && reason !== 'replace') {
      this.stopGeneration += 1;
    }
    // Disable auto-reconnect
    this.shouldReconnect = false;

    // Clear all timers
    this.clearAllTimers();

    // If this manager is attached to an external gateway process, ask it to shut down
    // over protocol before closing the socket.
    const shouldShutdownExternal = options?.shutdownExternal !== false;

    if (
      shouldShutdownExternal
      && !this.ownsProcess
      && this.ws?.readyState === WebSocket.OPEN
      && this.externalShutdownSupported !== false
    ) {
      try {
        await this.rpc('shutdown', undefined, 5000);
        this.externalShutdownSupported = true;
      } catch (error) {
        if (this.isUnsupportedShutdownError(error)) {
          this.externalShutdownSupported = false;
          logger.info('External Gateway does not support "shutdown"; skipping shutdown RPC for future stops');
        } else {
          logger.warn('Failed to request shutdown for externally managed Gateway:', error);
        }
      }
    }

    // Close WebSocket
    if (this.ws) {
      this.ws.close(1000, 'Gateway stopped by user');
      this.ws = null;
    }

    // Kill process
    if (this.process && this.ownsProcess) {
      const child = this.process;
      await terminateOwnedGatewayProcess(child);

      if (this.process === child) {
        this.process = null;
      }
    }
    this.ownsProcess = false;

    clearPendingGatewayRequests(this.pendingRequests, new Error('Gateway stopped'));

    this.restartController.resetDeferredRestart();
    this.setStatus({ state: 'stopped', error: undefined, pid: undefined, connectedAt: undefined, uptime: undefined });
  }

  async detach(options?: { reason?: 'quit' | 'handoff' }): Promise<void> {
    const reason = options?.reason ?? 'quit';
    logger.info(`Gateway detach requested (reason=${reason})`);
    this.lifecycleController.bump(`detach:${reason}`);
    this.shouldReconnect = false;
    this.clearAllTimers();

    const closeReason = reason === 'handoff'
      ? 'Gateway detached for runtime handoff'
      : 'Gateway detached for app quit';

    if (this.ws) {
      this.ws.close(1000, closeReason);
      this.ws = null;
    }

    this.process = null;
    this.ownsProcess = false;
    clearPendingGatewayRequests(this.pendingRequests, new Error('Gateway detached'));
    this.restartController.resetDeferredRestart();
    this.setStatus({ state: 'stopped', error: undefined, pid: undefined, connectedAt: undefined, uptime: undefined });
  }

  async handoffForQuit(): Promise<void> {
    if (this.status.state !== 'running' || !this.status.pid) {
      await this.detach({ reason: 'quit' });
      return;
    }

    const launchContext = await prepareGatewayLaunchContext(this.status.port);
    await launchGatewayHandoffProcess({
      launchContext,
      waitForPid: this.status.pid,
      port: this.status.port,
      sanitizeSpawnArgs: (args) => this.sanitizeSpawnArgs(args),
    });
    await this.detach({ reason: 'handoff' });
  }

  /**
   * Restart Gateway process
   */
  async restart(options?: { expectedStopGeneration?: number }): Promise<void> {
    const expectedStopGeneration = options?.expectedStopGeneration ?? this.stopGeneration;
    if (this.shouldAbortRefresh(expectedStopGeneration, 'restart:before-begin')) {
      return;
    }

    if (this.restartController.isRestartDeferred({
      state: this.status.state,
      startLock: this.startLock,
    })) {
      this.restartController.markDeferredRestart('restart', {
        state: this.status.state,
        startLock: this.startLock,
      });
      return;
    }

    if (this.restartInFlight) {
      logger.debug('Gateway restart already in progress, joining existing request');
      await this.restartInFlight;
      return;
    }

    const decision = this.restartGovernor.decide();
    if (!decision.allow) {
      const observability = this.restartGovernor.getObservability();
      logger.warn(
        `[gateway-restart-governor] restart suppressed reason=${decision.reason} retryAfterMs=${decision.retryAfterMs} ` +
        `suppressed=${observability.suppressed_total} executed=${observability.executed_total} circuitOpenUntil=${observability.circuit_open_until}`,
      );
      const props = {
        reason: decision.reason,
        retry_after_ms: decision.retryAfterMs,
        gateway_restart_suppressed_total: observability.suppressed_total,
        gateway_restart_executed_total: observability.executed_total,
        gateway_restart_circuit_open_until: observability.circuit_open_until,
      };
      trackMetric('gateway.restart.suppressed', props);
      captureTelemetryEvent('gateway_restart_suppressed', props);
      return;
    }

    const pidBefore = this.status.pid;
    let restartApplied = false;
    logger.info(`[gateway-refresh] mode=restart requested pidBefore=${pidBefore ?? 'n/a'}`);
    this.restartInFlight = (async () => {
      await this.stop({ reason: 'restart' });
      if (this.shouldAbortRefresh(expectedStopGeneration, 'restart:before-start')) {
        return;
      }
      await this.start();
      restartApplied = true;
    })();

    try {
      await this.restartInFlight;
      if (!restartApplied) {
        logger.info(
          `[gateway-refresh] mode=restart result=aborted_by_stop pidBefore=${pidBefore ?? 'n/a'} pidAfter=${this.status.pid ?? 'n/a'}`,
        );
        return;
      }
      this.restartGovernor.recordExecuted();
      const observability = this.restartGovernor.getObservability();
      const props = {
        gateway_restart_executed_total: observability.executed_total,
        gateway_restart_suppressed_total: observability.suppressed_total,
        gateway_restart_circuit_open_until: observability.circuit_open_until,
      };
      trackMetric('gateway.restart.executed', props);
      captureTelemetryEvent('gateway_restart_executed', props);
      logger.info(
        `[gateway-refresh] mode=restart result=applied pidBefore=${pidBefore ?? 'n/a'} pidAfter=${this.status.pid ?? 'n/a'} ` +
        `suppressed=${observability.suppressed_total} executed=${observability.executed_total} circuitOpenUntil=${observability.circuit_open_until}`,
      );
    } finally {
      this.restartInFlight = null;
      this.restartController.flushDeferredRestart(
        'restart:finally',
        {
          state: this.status.state,
          startLock: this.startLock,
          shouldReconnect: this.shouldReconnect,
        },
        () => {
          void this.restart().catch((error) => {
            logger.warn('Deferred Gateway restart failed:', error);
          });
        },
      );
    }
  }

  async replaceRuntime(): Promise<void> {
    const expectedStopGeneration = this.stopGeneration;
    if (this.restartInFlight) {
      logger.debug('Gateway replace already in progress, joining existing request');
      await this.restartInFlight;
      return;
    }

    if (this.status.state === 'stopped') {
      logger.debug('Gateway replace skipped because runtime is already stopped');
      return;
    }

    this.restartInFlight = (async () => {
      logger.info(`[gateway-refresh] mode=replace requested pidBefore=${this.status.pid ?? 'n/a'} port=${this.status.port}`);
      this.lifecycleController.bump('replace');
      this.shouldReconnect = false;
      this.clearAllTimers();

      const managedChild = this.ownsProcess ? this.process : null;
      const port = this.status.port;

      if (this.ws) {
        this.ws.close(1000, 'Gateway runtime replaced');
        this.ws = null;
      }

      if (managedChild) {
        this.process = null;
        this.ownsProcess = false;
        await terminateOwnedGatewayProcess(managedChild);
      } else {
        await terminateGatewayProcessesListeningOnPort(port);
        this.process = null;
        this.ownsProcess = false;
      }

      clearPendingGatewayRequests(this.pendingRequests, new Error('Gateway runtime replaced'));
      this.restartController.resetDeferredRestart();
      this.setStatus({ state: 'stopped', error: undefined, pid: undefined, connectedAt: undefined, uptime: undefined });
      if (this.shouldAbortRefresh(expectedStopGeneration, 'replace:before-start')) {
        return;
      }
      await this.start();
    })();

    try {
      await this.restartInFlight;
    } finally {
      this.restartInFlight = null;
      this.restartController.flushDeferredRestart(
        'replace:finally',
        {
          state: this.status.state,
          startLock: this.startLock,
          shouldReconnect: this.shouldReconnect,
        },
        () => {
          void this.restart().catch((error) => {
            logger.warn('Deferred Gateway restart failed:', error);
          });
        },
      );
    }
  }

  /**
   * Debounced restart — coalesces multiple rapid restart requests into a
   * single restart after `delayMs` of inactivity.  This prevents the
   * cascading stop/start cycles that occur when provider:save,
   * provider:setDefault and channel:saveConfig all fire within seconds
   * of each other during setup.
   */
  debouncedRestart(delayMs = 2000): void {
    const expectedStopGeneration = this.stopGeneration;
    this.restartController.debouncedRestart(delayMs, () => {
      void this.restart({ expectedStopGeneration }).catch((err) => {
        logger.warn('Debounced Gateway restart failed:', err);
      });
    });
  }

  /**
   * Ask the Gateway process to reload config in-place when possible.
   * Falls back to restart on unsupported platforms or signaling failures.
   */
  async reload(options?: { expectedStopGeneration?: number }): Promise<void> {
    const expectedStopGeneration = options?.expectedStopGeneration ?? this.stopGeneration;
    if (this.shouldAbortRefresh(expectedStopGeneration, 'reload:before-begin')) {
      return;
    }

    await this.refreshReloadPolicy();

    if (this.reloadPolicy.mode === 'off' || this.reloadPolicy.mode === 'restart') {
      logger.info(
        `[gateway-refresh] mode=reload result=policy_forced_restart policy=${this.reloadPolicy.mode}`,
      );
      await this.restart({ expectedStopGeneration });
      return;
    }

    if (this.restartController.isRestartDeferred({
      state: this.status.state,
      startLock: this.startLock,
    })) {
      this.restartController.markDeferredRestart('reload', {
        state: this.status.state,
        startLock: this.startLock,
      });
      return;
    }

    const pidBefore = this.process?.pid;
    logger.info(`[gateway-refresh] mode=reload requested pid=${pidBefore ?? 'n/a'} state=${this.status.state}`);

    if (!this.process?.pid || this.status.state !== 'running') {
      logger.warn('[gateway-refresh] mode=reload result=fallback_restart cause=not_running');
      logger.warn('Gateway reload requested while not running; falling back to restart');
      await this.restart({ expectedStopGeneration });
      return;
    }

    if (process.platform === 'win32') {
      logger.warn('[gateway-refresh] mode=reload result=fallback_restart cause=windows');
      logger.debug('Windows detected, falling back to Gateway restart for reload');
      await this.restart({ expectedStopGeneration });
      return;
    }

    const connectedForMs = this.status.connectedAt
      ? Date.now() - this.status.connectedAt
      : Number.POSITIVE_INFINITY;

    // Avoid signaling a process that just came up; it will already read latest config.
    if (connectedForMs < 8000) {
      logger.info(
        `[gateway-refresh] mode=reload result=skipped_recent_connect connectedForMs=${connectedForMs} pid=${this.process.pid}`,
      );
      logger.info(`Gateway connected ${connectedForMs}ms ago, skipping reload signal`);
      return;
    }

    try {
      process.kill(this.process.pid, 'SIGUSR1');
      logger.info(`Sent SIGUSR1 to Gateway for config reload (pid=${this.process.pid})`);
      // Some gateway builds do not handle SIGUSR1 as an in-process reload.
      // If process state doesn't recover quickly, fall back to restart.
      await new Promise((resolve) => setTimeout(resolve, 1500));
      if (this.shouldAbortRefresh(expectedStopGeneration, 'reload:after-signal')) {
        return;
      }
      if (this.status.state !== 'running' || !this.process?.pid) {
        logger.warn('[gateway-refresh] mode=reload result=fallback_restart cause=post_signal_unhealthy');
        logger.warn('Gateway did not stay running after reload signal, falling back to restart');
        await this.restart({ expectedStopGeneration });
      } else {
        const pidAfter = this.process.pid;
        logger.info(
          `[gateway-refresh] mode=reload result=applied_in_place pidBefore=${pidBefore} pidAfter=${pidAfter}`,
        );
      }
    } catch (error) {
      logger.warn('[gateway-refresh] mode=reload result=fallback_restart cause=signal_error');
      logger.warn('Gateway reload signal failed, falling back to restart:', error);
      await this.restart({ expectedStopGeneration });
    }
  }

  /**
   * Debounced reload — coalesces multiple rapid config-change events into one
   * in-process reload when possible.
   */
  debouncedReload(delayMs?: number): void {
    const expectedStopGeneration = this.stopGeneration;
    void this.refreshReloadPolicy();
    const effectiveDelay = delayMs ?? this.reloadPolicy.debounceMs;
    if (this.reloadPolicy.mode === 'off' || this.reloadPolicy.mode === 'restart') {
      logger.debug(
        `Gateway reload policy=${this.reloadPolicy.mode}; routing debouncedReload to debouncedRestart (${effectiveDelay}ms)`,
      );
      this.debouncedRestart(effectiveDelay);
      return;
    }

    if (this.reloadDebounceTimer) {
      clearTimeout(this.reloadDebounceTimer);
    }
    logger.debug(`Gateway reload debounced (will fire in ${effectiveDelay}ms)`);
    this.reloadDebounceTimer = setTimeout(() => {
      this.reloadDebounceTimer = null;
      void this.reload({ expectedStopGeneration }).catch((err) => {
        logger.warn('Debounced Gateway reload failed:', err);
      });
    }, effectiveDelay);
  }

  private async refreshReloadPolicy(force = false): Promise<void> {
    const now = Date.now();
    if (!force && now - this.reloadPolicyLoadedAt < GatewayManager.RELOAD_POLICY_REFRESH_MS) {
      return;
    }

    if (this.reloadPolicyRefreshPromise) {
      await this.reloadPolicyRefreshPromise;
      return;
    }

    this.reloadPolicyRefreshPromise = (async () => {
      const nextPolicy = await loadGatewayReloadPolicy();
      this.reloadPolicy = nextPolicy;
      this.reloadPolicyLoadedAt = Date.now();
    })();

    try {
      await this.reloadPolicyRefreshPromise;
    } finally {
      this.reloadPolicyRefreshPromise = null;
    }
  }

  /**
   * Clear all active timers
   */
  private clearAllTimers(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.connectionMonitor.clear();
    this.restartController.clearDebounceTimer();
    if (this.reloadDebounceTimer) {
      clearTimeout(this.reloadDebounceTimer);
      this.reloadDebounceTimer = null;
    }
  }

  /**
   * Make an RPC call to the Gateway
   * Uses OpenClaw protocol format: { type: "req", id: "...", method: "...", params: {...} }
   */
  async rpc<T>(method: string, params?: unknown, timeoutMs = 30000): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('Gateway not connected'));
        return;
      }

      const id = crypto.randomUUID();

      // Set timeout for request
      const timeout = setTimeout(() => {
        rejectPendingGatewayRequest(this.pendingRequests, id, new Error(`RPC timeout: ${method}`));
      }, timeoutMs);

      // Store pending request
      this.pendingRequests.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
        timeout,
      });

      // Send request using OpenClaw protocol format
      const request = {
        type: 'req',
        id,
        method,
        params,
      };

      try {
        this.ws.send(JSON.stringify(request));
      } catch (error) {
        rejectPendingGatewayRequest(this.pendingRequests, id, new Error(`Failed to send RPC request: ${error}`));
      }
    });
  }

  /**
   * Start health check monitoring
   */
  private startHealthCheck(): void {
    this.consecutiveHealthFailures = 0;
    this.connectionMonitor.startHealthCheck({
      shouldCheck: () => this.status.state === 'running',
      checkHealth: () => this.checkHealth(),
      onHealthy: () => {
        this.consecutiveHealthFailures = 0;
      },
      onUnhealthy: (errorMessage) => {
        this.emit('error', new Error(errorMessage));
        this.consecutiveHealthFailures += 1;
        if (this.consecutiveHealthFailures < 3 || this.status.state !== 'running') {
          return;
        }
        void this.handleCriticalHealthFailure(errorMessage);
      },
      onError: () => {
        // The monitor already logged the error; nothing else to do here.
      },
    });
  }

  private async handleCriticalHealthFailure(errorMessage: string): Promise<void> {
    this.consecutiveHealthFailures = 0;
    const managedChild = this.ownsProcess ? this.process : null;
    if (this.ws) {
      this.ws.terminate();
      this.ws = null;
    }
    this.setStatus({
      state: 'error',
      error: `Health check failed: ${errorMessage}`,
    });
    if (managedChild) {
      this.process = null;
      this.ownsProcess = false;
      await terminateOwnedGatewayProcess(managedChild);
    }
    await this.requestReconnect('health-check', errorMessage);
  }

  /**
   * Check Gateway health via WebSocket ping
   * OpenClaw Gateway doesn't have an HTTP /health endpoint
   */
  async checkHealth(): Promise<{ ok: boolean; error?: string; uptime?: number; version?: string }> {
    try {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        return { ok: false, error: 'WebSocket not connected' };
      }

      if (this.healthRpcSupported !== false) {
        try {
          const health = await this.rpc<GatewayHealthPayload>('system.health', undefined, 5000);
          this.healthRpcSupported = true;
          if (health.version && health.version !== this.status.version) {
            this.setStatus({ version: health.version });
          }
          if (health.status && health.status !== 'healthy') {
            return { ok: false, error: health.status };
          }
          return {
            ok: true,
            uptime: health.uptime,
            version: health.version,
          };
        } catch (error) {
          if (this.isUnsupportedHealthError(error)) {
            this.healthRpcSupported = false;
          } else {
            return {
              ok: false,
              error: error instanceof Error ? error.message : String(error),
            };
          }
        }
      }

      const uptime = this.status.connectedAt
        ? Math.floor((Date.now() - this.status.connectedAt) / 1000)
        : undefined;
      return { ok: true, uptime };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Start Gateway process
   * Uses OpenClaw npm package from node_modules (dev) or resources (production)
   */
  private async startProcess(): Promise<void> {
    const launchContext = await prepareGatewayLaunchContext(this.status.port);
    await unloadLaunchctlGatewayService();
    this.processExitCode = null;

    const { child, lastSpawnSummary } = await launchGatewayProcess({
      port: this.status.port,
      launchContext,
      sanitizeSpawnArgs: (args) => this.sanitizeSpawnArgs(args),
      getCurrentState: () => this.status.state,
      getShouldReconnect: () => this.shouldReconnect,
      onStderrLine: (line) => {
        recordGatewayStartupStderrLine(this.recentStartupStderrLines, line);
        const classified = classifyGatewayStderrMessage(line);
        if (classified.level === 'drop') return;
        if (classified.level === 'debug') {
          logger.debug(`[Gateway stderr] ${classified.normalized}`);
          return;
        }
        logger.warn(`[Gateway stderr] ${classified.normalized}`);
      },
      onSpawn: (pid) => {
        this.setStatus({ pid });
      },
      onExit: (exitedChild, code) => {
        this.processExitCode = code;
        this.ownsProcess = false;
        if (this.process === exitedChild) {
          this.process = null;
        }
        this.emit('exit', code);

        if (this.status.state === 'running') {
          this.setStatus({ state: 'stopped' });
          void this.requestReconnect('child-exit', code === null ? undefined : String(code));
        }
      },
      onError: () => {
        this.ownsProcess = false;
        if (this.process === child) {
          this.process = null;
        }
      },
    });

    this.process = child;
    this.ownsProcess = true;
    this.lastSpawnSummary = lastSpawnSummary;
  }

  /**
   * Connect WebSocket to Gateway
   */
  private async connect(port: number, _externalToken?: string): Promise<void> {
    this.ws = await connectGatewaySocket({
      port,
      deviceIdentity: this.deviceIdentity,
      platform: process.platform,
      pendingRequests: this.pendingRequests,
      getToken: async () => await import('../utils/store').then(({ getSetting }) => getSetting('gatewayToken')),
      onHandshakeComplete: (ws) => {
        this.ws = ws;
        this.healthRpcSupported = null;
        this.consecutiveHealthFailures = 0;
        this.ws.on('pong', () => {
          this.connectionMonitor.handlePong();
        });
        this.setStatus({
          state: 'running',
          port,
          connectedAt: Date.now(),
        });
        this.startPing();
      },
      onMessage: (message) => {
        this.handleMessage(message);
      },
      onCloseAfterHandshake: () => {
        if (this.status.state === 'running') {
          this.setStatus({ state: 'stopped' });
          void this.requestReconnect('ws-close', 'Gateway websocket closed');
        }
      },
    });
  }

  /**
   * Handle incoming WebSocket message
   */
  private handleMessage(message: unknown): void {
    if (typeof message !== 'object' || message === null) {
      logger.debug('Received non-object Gateway message');
      return;
    }

    const msg = message as Record<string, unknown>;

    // Handle OpenClaw protocol response format: { type: "res", id: "...", ok: true/false, ... }
    if (msg.type === 'res' && typeof msg.id === 'string') {
      if (msg.ok === false || msg.error) {
        const errorObj = msg.error as { message?: string; code?: number } | undefined;
        const errorMsg = errorObj?.message || JSON.stringify(msg.error) || 'Unknown error';
        if (rejectPendingGatewayRequest(this.pendingRequests, msg.id, new Error(errorMsg))) {
          return;
        }
      } else if (resolvePendingGatewayRequest(this.pendingRequests, msg.id, msg.payload ?? msg)) {
        return;
      }
    }

    // Handle OpenClaw protocol event format: { type: "event", event: "...", payload: {...} }
    if (msg.type === 'event' && typeof msg.event === 'string') {
      dispatchProtocolEvent(this, msg.event, msg.payload);
      return;
    }

    // Fallback: Check if this is a JSON-RPC 2.0 response (legacy support)
    if (isResponse(message) && message.id && this.pendingRequests.has(String(message.id))) {
      if (message.error) {
        const errorMsg = typeof message.error === 'object'
          ? (message.error as { message?: string }).message || JSON.stringify(message.error)
          : String(message.error);
        rejectPendingGatewayRequest(this.pendingRequests, String(message.id), new Error(errorMsg));
      } else {
        resolvePendingGatewayRequest(this.pendingRequests, String(message.id), message.result);
      }
      return;
    }

    // Check if this is a JSON-RPC notification (server-initiated event)
    if (isNotification(message)) {
      dispatchJsonRpcNotification(this, message);
      return;
    }

    this.emit('message', message);
  }

  /**
   * Start ping interval to keep connection alive
   */
  private startPing(): void {
    this.connectionMonitor.startPing(
      () => {
        if (this.ws?.readyState === WebSocket.OPEN) {
          this.ws.ping();
        }
      },
      () => {
        logger.error('Gateway WebSocket dead connection detected (pong timeout)');
        if (this.ws) {
          this.ws.terminate(); // Force close the dead connection immediately
          this.ws = null;
        }
        if (this.status.state === 'running') {
          this.setStatus({ state: 'error', error: 'WebSocket ping timeout' });
          void this.requestReconnect('ping-timeout', 'WebSocket ping timeout');
        }
      }
    );
  }

  private async requestReconnect(
    trigger: GatewayRecoveryTrigger,
    error?: string,
  ): Promise<void> {
    const context: GatewayRecoveryContext = {
      trigger,
      plannedAction: 'reconnect',
      currentState: this.status.state,
      ownsProcess: this.ownsProcess,
      reconnectAttempts: this.reconnectAttempts,
      ...(error ? { error } : {}),
    };

    if (!(await this.shouldAllowRecovery(context))) {
      logger.debug(`Gateway recovery denied (trigger=${trigger})`);
      return;
    }

    this.scheduleReconnect();
  }

  private async shouldAllowRecovery(context: GatewayRecoveryContext): Promise<boolean> {
    if (!this.recoveryArbiter) {
      return true;
    }

    try {
      return await this.recoveryArbiter(context);
    } catch (error) {
      logger.warn('Gateway recovery arbiter failed:', error);
      return false;
    }
  }

  /**
   * Schedule reconnection attempt with exponential backoff
   */
  private scheduleReconnect(): void {
    const decision = getReconnectScheduleDecision({
      shouldReconnect: this.shouldReconnect,
      hasReconnectTimer: this.reconnectTimer !== null,
      reconnectAttempts: this.reconnectAttempts,
      maxAttempts: this.reconnectConfig.maxAttempts,
      baseDelay: this.reconnectConfig.baseDelay,
      maxDelay: this.reconnectConfig.maxDelay,
    });

    if (decision.action === 'skip') {
      logger.debug(`Gateway reconnect skipped (${decision.reason})`);
      return;
    }

    if (decision.action === 'already-scheduled') {
      return;
    }

    if (decision.action === 'fail') {
      logger.error(`Gateway reconnect failed: max attempts reached (${decision.maxAttempts})`);
      this.setStatus({
        state: 'error',
        error: 'Failed to reconnect after maximum attempts',
        reconnectAttempts: this.reconnectAttempts
      });
      return;
    }

    const cooldownRemaining = Math.max(0, GatewayManager.RESTART_COOLDOWN_MS - (Date.now() - this.lastRestartAt));
    const { delay, nextAttempt, maxAttempts } = decision;
    const effectiveDelay = Math.max(delay, cooldownRemaining);
    this.reconnectAttempts = nextAttempt;
    logger.warn(`Scheduling Gateway reconnect attempt ${nextAttempt}/${maxAttempts} in ${effectiveDelay}ms`);

    this.setStatus({
      state: 'reconnecting',
      reconnectAttempts: this.reconnectAttempts
    });
    const scheduledEpoch = this.lifecycleController.getCurrentEpoch();

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      const skipReason = getReconnectSkipReason({
        scheduledEpoch,
        currentEpoch: this.lifecycleController.getCurrentEpoch(),
        shouldReconnect: this.shouldReconnect,
      });
      if (skipReason) {
        logger.debug(`Skipping reconnect attempt: ${skipReason}`);
        return;
      }
      const attemptNo = this.reconnectAttempts;
      this.reconnectAttemptsTotal += 1;
      try {
        // Use the guarded start() flow so reconnect attempts cannot bypass
        // lifecycle locking and accidentally start duplicate Gateway processes.
        await this.start();
        this.reconnectSuccessTotal += 1;
        this.emitReconnectMetric('success', {
          attemptNo,
          maxAttempts,
          delayMs: effectiveDelay,
        });
        this.reconnectAttempts = 0;
      } catch (error) {
        logger.error('Gateway reconnection attempt failed:', error);
        this.emitReconnectMetric('failure', {
          attemptNo,
          maxAttempts,
          delayMs: effectiveDelay,
          error: error instanceof Error ? error.message : String(error),
        });
        void this.requestReconnect(
          'reconnect-failure',
          error instanceof Error ? error.message : String(error),
        );
      }
    }, effectiveDelay);
  }

  private emitReconnectMetric(
    outcome: 'success' | 'failure',
    payload: {
      attemptNo: number;
      maxAttempts: number;
      delayMs: number;
      error?: string;
    },
  ): void {
    const successRate = this.reconnectAttemptsTotal > 0
      ? this.reconnectSuccessTotal / this.reconnectAttemptsTotal
      : 0;

    const properties = {
      outcome,
      attemptNo: payload.attemptNo,
      maxAttempts: payload.maxAttempts,
      delayMs: payload.delayMs,
      gateway_reconnect_success_count: this.reconnectSuccessTotal,
      gateway_reconnect_attempt_count: this.reconnectAttemptsTotal,
      gateway_reconnect_success_rate: Number(successRate.toFixed(4)),
      ...(payload.error ? { error: payload.error } : {}),
    };

    trackMetric('gateway.reconnect', properties);
    captureTelemetryEvent('gateway_reconnect', properties);
  }

  /**
   * Update status and emit event
   */
  private setStatus(update: Partial<GatewayStatus>): void {
    this.stateController.setStatus(update);
  }
}
