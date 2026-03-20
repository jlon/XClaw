import { app, utilityProcess } from 'electron';
import { existsSync, writeFileSync } from 'fs';
import { spawn } from 'node:child_process';
import path from 'path';
import type { GatewayLaunchContext } from './config-sync';
import type { GatewayLifecycleState } from './process-policy';
import { logger } from '../utils/logger';
import { appendNodeRequireToNodeOptions } from '../utils/paths';
import { getGatewayHandoffMarkerPath, writeGatewayHandoffMarker } from './handoff-marker';

const GATEWAY_FETCH_PRELOAD_SOURCE = `'use strict';
(function () {
  var _f = globalThis.fetch;
  if (typeof _f !== 'function') return;
  if (globalThis.__XClawFetchPatched) return;
  globalThis.__XClawFetchPatched = true;

  globalThis.fetch = function XClawFetch(input, init) {
    var url =
      typeof input === 'string' ? input
        : input && typeof input === 'object' && typeof input.url === 'string'
          ? input.url : '';

    if (url.indexOf('openrouter.ai') !== -1) {
      init = init ? Object.assign({}, init) : {};
      var prev = init.headers;
      var flat = {};
      if (prev && typeof prev.forEach === 'function') {
        prev.forEach(function (v, k) { flat[k] = v; });
      } else if (prev && typeof prev === 'object') {
        Object.assign(flat, prev);
      }
      delete flat['http-referer'];
      delete flat['HTTP-Referer'];
      delete flat['x-title'];
      delete flat['X-Title'];
      flat['HTTP-Referer'] = 'https://claw-x.com';
      flat['X-Title'] = 'XClaw';
      init.headers = flat;
    }
    return _f.call(globalThis, input, init);
  };

  if (process.platform === 'win32') {
    try {
      var cp = require('child_process');
      if (!cp.__XClawPatched) {
        cp.__XClawPatched = true;
        ['spawn', 'exec', 'execFile', 'fork', 'spawnSync', 'execSync', 'execFileSync'].forEach(function(method) {
          var original = cp[method];
          if (typeof original !== 'function') return;
          cp[method] = function() {
            var args = Array.prototype.slice.call(arguments);
            var optIdx = -1;
            for (var i = 1; i < args.length; i++) {
              var a = args[i];
              if (a && typeof a === 'object' && !Array.isArray(a)) {
                optIdx = i;
                break;
              }
            }
            if (optIdx >= 0) {
              args[optIdx].windowsHide = true;
            } else {
              var opts = { windowsHide: true };
              if (typeof args[args.length - 1] === 'function') {
                args.splice(args.length - 1, 0, opts);
              } else {
                args.push(opts);
              }
            }
            return original.apply(this, args);
          };
        });
      }
    } catch (e) {
      // ignore
    }
  }
})();
`;

function ensureGatewayFetchPreload(): string {
  const dest = path.join(app.getPath('userData'), 'gateway-fetch-preload.cjs');
  try {
    writeFileSync(dest, GATEWAY_FETCH_PRELOAD_SOURCE, 'utf-8');
  } catch {
    // best-effort
  }
  return dest;
}

const GATEWAY_HANDOFF_LAUNCHER_SOURCE = `'use strict';
const { spawn } = require('child_process');
const { unlinkSync } = require('fs');
const net = require('net');

const payloadRaw = process.env.CLAWX_GATEWAY_HANDOFF_PAYLOAD || '';

function decodePayload(value) {
  if (!value) throw new Error('Missing CLAWX_GATEWAY_HANDOFF_PAYLOAD');
  return JSON.parse(Buffer.from(value, 'base64').toString('utf8'));
}

function clearMarker(markerPath) {
  if (!markerPath) return;
  try {
    unlinkSync(markerPath);
  } catch {
    // ignore
  }
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function pidExists(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function isPortFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port, '127.0.0.1');
  });
}

(async () => {
  const payload = decodePayload(payloadRaw);
  const deadline = Date.now() + (payload.waitTimeoutMs || 30000);
  let readyToSpawn = false;

  while (Date.now() < deadline) {
    const currentPidAlive = pidExists(payload.waitForPid);
    const portFree = await isPortFree(payload.port);
    if (!currentPidAlive && portFree) {
      readyToSpawn = true;
      break;
    }
    await wait(500);
  }

  if (!readyToSpawn) {
    clearMarker(payload.markerPath);
    process.exit(0);
  }

  const nextEnv = {
    ...process.env,
    ...payload.runtimeEnv,
    ELECTRON_RUN_AS_NODE: '1',
  };
  delete nextEnv.CLAWX_GATEWAY_HANDOFF_PAYLOAD;

  const child = spawn(payload.execPath, [payload.entryScript, ...payload.gatewayArgs], {
    cwd: payload.cwd,
    detached: true,
    stdio: 'ignore',
    env: nextEnv,
    windowsHide: true,
  });

  child.unref();
})().catch(() => {
  try {
    const payload = decodePayload(payloadRaw);
    clearMarker(payload.markerPath);
  } catch {
    // ignore
  }
  process.exit(1);
});
`;

function ensureGatewayHandoffLauncher(): string {
  const dest = path.join(app.getPath('userData'), 'gateway-handoff-launcher.cjs');
  try {
    writeFileSync(dest, GATEWAY_HANDOFF_LAUNCHER_SOURCE, 'utf-8');
  } catch {
    // best-effort
  }
  return dest;
}

function buildGatewayRuntimeEnv(
  forkEnv: Record<string, string | undefined>,
): Record<string, string | undefined> {
  const runtimeEnv = { ...forkEnv };
  if (!app.isPackaged) {
    try {
      const preloadPath = ensureGatewayFetchPreload();
      if (existsSync(preloadPath)) {
        runtimeEnv.NODE_OPTIONS = appendNodeRequireToNodeOptions(
          runtimeEnv.NODE_OPTIONS,
          preloadPath,
        );
      }
    } catch (err) {
      logger.warn('Failed to set up OpenRouter headers preload:', err);
    }
  }
  return runtimeEnv;
}

export async function launchGatewayProcess(options: {
  port: number;
  launchContext: GatewayLaunchContext;
  sanitizeSpawnArgs: (args: string[]) => string[];
  getCurrentState: () => GatewayLifecycleState;
  getShouldReconnect: () => boolean;
  onStderrLine: (line: string) => void;
  onSpawn: (pid: number | undefined) => void;
  onExit: (child: Electron.UtilityProcess, code: number | null) => void;
  onError: (error: Error) => void;
}): Promise<{ child: Electron.UtilityProcess; lastSpawnSummary: string }> {
  const {
    openclawDir,
    entryScript,
    gatewayArgs,
    forkEnv,
    mode,
    binPathExists,
    loadedProviderKeyCount,
    proxySummary,
    channelStartupSummary,
  } = options.launchContext;

  logger.info(
    `Starting Gateway process (mode=${mode}, port=${options.port}, entry="${entryScript}", args="${options.sanitizeSpawnArgs(gatewayArgs).join(' ')}", cwd="${openclawDir}", bundledBin=${binPathExists ? 'yes' : 'no'}, providerKeys=${loadedProviderKeyCount}, channels=${channelStartupSummary}, proxy=${proxySummary})`,
  );
  const lastSpawnSummary = `mode=${mode}, entry="${entryScript}", args="${options.sanitizeSpawnArgs(gatewayArgs).join(' ')}", cwd="${openclawDir}"`;
  const runtimeEnv = buildGatewayRuntimeEnv(forkEnv);

  return await new Promise<{ child: Electron.UtilityProcess; lastSpawnSummary: string }>((resolve, reject) => {
    const child = utilityProcess.fork(entryScript, gatewayArgs, {
      cwd: openclawDir,
      stdio: 'pipe',
      env: runtimeEnv as NodeJS.ProcessEnv,
      serviceName: 'OpenClaw Gateway',
    });

    let settled = false;
    const resolveOnce = () => {
      if (settled) return;
      settled = true;
      resolve({ child, lastSpawnSummary });
    };
    const rejectOnce = (error: Error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };

    child.on('error', (error) => {
      logger.error('Gateway process spawn error:', error);
      options.onError(error);
      rejectOnce(error);
    });

    child.on('exit', (code: number) => {
      const expectedExit = !options.getShouldReconnect() || options.getCurrentState() === 'stopped';
      const level = expectedExit ? logger.info : logger.warn;
      level(`Gateway process exited (code=${code}, expected=${expectedExit ? 'yes' : 'no'})`);
      options.onExit(child, code);
    });

    child.stderr?.on('data', (data) => {
      const raw = data.toString();
      for (const line of raw.split(/\r?\n/)) {
        options.onStderrLine(line);
      }
    });

    child.on('spawn', () => {
      logger.info(`Gateway process started (pid=${child.pid})`);
      options.onSpawn(child.pid);
      resolveOnce();
    });
  });
}

export async function launchGatewayHandoffProcess(options: {
  launchContext: GatewayLaunchContext;
  waitForPid: number;
  port: number;
  sanitizeSpawnArgs: (args: string[]) => string[];
}): Promise<void> {
  const runtimeEnv = buildGatewayRuntimeEnv(options.launchContext.forkEnv);
  const launcherPath = ensureGatewayHandoffLauncher();
  await writeGatewayHandoffMarker({
    port: options.port,
    waitForPid: options.waitForPid,
    createdAt: Date.now(),
    expiresAt: Date.now() + 75_000,
  });
  const payload = Buffer.from(JSON.stringify({
    execPath: process.execPath,
    cwd: options.launchContext.openclawDir,
    entryScript: options.launchContext.entryScript,
    gatewayArgs: options.launchContext.gatewayArgs,
    runtimeEnv,
    waitForPid: options.waitForPid,
    waitTimeoutMs: 30_000,
    port: options.port,
    markerPath: getGatewayHandoffMarkerPath(),
  }), 'utf8').toString('base64');

  logger.info(
    `Scheduling detached Gateway handoff (waitForPid=${options.waitForPid}, port=${options.port}, args="${options.sanitizeSpawnArgs(options.launchContext.gatewayArgs).join(' ')}")`,
  );

  const launcher = spawn(process.execPath, [launcherPath], {
    cwd: options.launchContext.openclawDir,
    detached: true,
    stdio: 'ignore',
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      CLAWX_GATEWAY_HANDOFF_PAYLOAD: payload,
    },
    windowsHide: true,
  });

  launcher.unref();
}
