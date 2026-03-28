import { app } from 'electron';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { getOpenClawRootMode } from './paths';
import { logger } from './logger';

export interface OpenClawLaunchRuntime {
  kind: 'node' | 'utility-process';
  execPath: string;
  useElectronRunAsNode: boolean;
}

function resolveNodeExecPathFromPathEnv(): string | null {
  const pathEnv = process.env.PATH || '';
  const candidateNames = process.platform === 'win32'
    ? ['node.exe', 'node.cmd', 'node.bat']
    : ['node'];

  for (const dir of pathEnv.split(path.delimiter).filter(Boolean)) {
    for (const candidateName of candidateNames) {
      const candidate = path.join(dir, candidateName);
      if (existsSync(candidate)) {
        return candidate;
      }
    }
  }

  return null;
}

function resolveNodeExecPath(): string | null {
  const envCandidates = [
    process.env.XCLAW_OPENCLAW_NODE_PATH,
    process.env.npm_node_execpath,
  ];

  for (const candidate of envCandidates) {
    if (typeof candidate === 'string' && candidate.trim() && existsSync(candidate.trim())) {
      return candidate.trim();
    }
  }

  return resolveNodeExecPathFromPathEnv();
}

export function resolveOpenClawLaunchRuntime(): OpenClawLaunchRuntime {
  if (!app.isPackaged && getOpenClawRootMode() === 'takeover') {
    const nodeExecPath = resolveNodeExecPath();
    if (nodeExecPath) {
      return {
        kind: 'node',
        execPath: nodeExecPath,
        useElectronRunAsNode: false,
      };
    }

    logger.warn('Failed to resolve external Node.js runtime for dev takeover mode; falling back to Electron utility process');
  }

  return {
    kind: 'utility-process',
    execPath: process.execPath,
    useElectronRunAsNode: true,
  };
}

export function applyOpenClawLaunchEnv(
  env: Record<string, string | undefined>,
  runtime: Pick<OpenClawLaunchRuntime, 'useElectronRunAsNode'>,
): NodeJS.ProcessEnv {
  const nextEnv = { ...env };
  if (runtime.useElectronRunAsNode) {
    nextEnv.ELECTRON_RUN_AS_NODE = '1';
  } else {
    delete nextEnv.ELECTRON_RUN_AS_NODE;
  }
  return nextEnv as NodeJS.ProcessEnv;
}
