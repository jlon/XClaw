import { existsSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';

const NODE_LLAMA_CPP_SCOPE = '@node-llama-cpp';

export function resolveNodeLlamaCppPackagesToKeep({ platform, arch }) {
  const normalizedPlatform = normalizeNodeLlamaCppPlatform(platform);
  const normalizedArch = normalizeNodeLlamaCppArch(arch);

  if (normalizedPlatform === 'mac' && normalizedArch === 'arm64') {
    return [`${NODE_LLAMA_CPP_SCOPE}/mac-arm64-metal`];
  }

  if (normalizedPlatform === 'mac' && normalizedArch === 'x64') {
    return [`${NODE_LLAMA_CPP_SCOPE}/mac-x64`];
  }

  if (normalizedPlatform === 'linux' && normalizedArch === 'x64') {
    return [`${NODE_LLAMA_CPP_SCOPE}/linux-x64`];
  }

  if (normalizedPlatform === 'linux' && normalizedArch === 'arm64') {
    return [`${NODE_LLAMA_CPP_SCOPE}/linux-arm64`];
  }

  if (normalizedPlatform === 'linux' && normalizedArch === 'armv7l') {
    return [`${NODE_LLAMA_CPP_SCOPE}/linux-armv7l`];
  }

  if (normalizedPlatform === 'win' && normalizedArch === 'x64') {
    return [`${NODE_LLAMA_CPP_SCOPE}/win-x64`];
  }

  if (normalizedPlatform === 'win' && normalizedArch === 'arm64') {
    return [`${NODE_LLAMA_CPP_SCOPE}/win-arm64`];
  }

  return [];
}

export function pruneNodeLlamaCppPackages(nodeModulesDir, target) {
  const scopeDir = path.join(nodeModulesDir, NODE_LLAMA_CPP_SCOPE);
  if (!existsSync(scopeDir)) {
    return [];
  }

  const keep = new Set(resolveNodeLlamaCppPackagesToKeep(target));
  const removed = [];

  for (const entry of readdirSync(scopeDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }

    const packageName = `${NODE_LLAMA_CPP_SCOPE}/${entry.name}`;
    if (keep.has(packageName)) {
      continue;
    }

    rmSync(path.join(scopeDir, entry.name), { recursive: true, force: true });
    removed.push(packageName);
  }

  return removed;
}

function normalizeNodeLlamaCppPlatform(platform) {
  if (platform === 'darwin' || platform === 'mac') {
    return 'mac';
  }

  if (platform === 'win32' || platform === 'win') {
    return 'win';
  }

  if (platform === 'linux') {
    return 'linux';
  }

  return platform;
}

function normalizeNodeLlamaCppArch(arch) {
  if (arch === 'arm') {
    return 'armv7l';
  }

  return arch;
}
