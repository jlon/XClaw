import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  pruneNodeLlamaCppPackages,
  resolveNodeLlamaCppPackagesToKeep,
} from '../../scripts/openclaw-bundle-pruning.mjs';
const { cleanupUnnecessaryFiles } = await import('../../scripts/after-pack.cjs');

describe('openclaw bundle pruning', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs) {
      rmSync(dir, { recursive: true, force: true });
    }
    tempDirs.length = 0;
  });

  it('keeps only the CPU package for the target Windows architecture', () => {
    expect(resolveNodeLlamaCppPackagesToKeep({ platform: 'win32', arch: 'x64' })).toEqual([
      '@node-llama-cpp/win-x64',
    ]);
    expect(resolveNodeLlamaCppPackagesToKeep({ platform: 'win32', arch: 'arm64' })).toEqual([
      '@node-llama-cpp/win-arm64',
    ]);
  });

  it('prunes non-target and GPU llama binaries from the packaged node_modules tree', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'xclaw-openclaw-prune-'));
    tempDirs.push(root);

    const nodeModulesDir = path.join(root, 'node_modules');
    mkdirSync(path.join(nodeModulesDir, 'node-llama-cpp'), { recursive: true });
    writeFileSync(path.join(nodeModulesDir, 'node-llama-cpp', 'package.json'), '{}');

    for (const packageName of [
      '@node-llama-cpp/win-x64',
      '@node-llama-cpp/win-x64-cuda',
      '@node-llama-cpp/win-x64-cuda-ext',
      '@node-llama-cpp/win-x64-vulkan',
      '@node-llama-cpp/win-arm64',
      '@node-llama-cpp/linux-x64',
    ]) {
      const dir = path.join(nodeModulesDir, ...packageName.split('/'));
      mkdirSync(dir, { recursive: true });
      writeFileSync(path.join(dir, 'package.json'), '{}');
    }

    const removed = pruneNodeLlamaCppPackages(nodeModulesDir, { platform: 'win32', arch: 'x64' });

    expect(removed.sort()).toEqual([
      '@node-llama-cpp/linux-x64',
      '@node-llama-cpp/win-arm64',
      '@node-llama-cpp/win-x64-cuda',
      '@node-llama-cpp/win-x64-cuda-ext',
      '@node-llama-cpp/win-x64-vulkan',
    ]);
    expect(existsSync(path.join(nodeModulesDir, '@node-llama-cpp', 'win-x64'))).toBe(true);
    expect(existsSync(path.join(nodeModulesDir, '@node-llama-cpp', 'win-arm64'))).toBe(false);
    expect(existsSync(path.join(nodeModulesDir, '@node-llama-cpp', 'win-x64-cuda'))).toBe(false);
    expect(existsSync(path.join(nodeModulesDir, '@node-llama-cpp', 'linux-x64'))).toBe(false);
  });

  it('preserves runtime TypeScript files inside bundled openclaw extensions', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'xclaw-after-pack-cleanup-'));
    tempDirs.push(root);

    const extensionDir = path.join(root, 'extensions', 'telegram', 'src');
    const nodeModuleDir = path.join(root, 'node_modules', 'somepkg');
    mkdirSync(extensionDir, { recursive: true });
    mkdirSync(nodeModuleDir, { recursive: true });

    const extensionEntry = path.join(root, 'extensions', 'telegram', 'index.ts');
    const extensionSource = path.join(extensionDir, 'channel.ts');
    const extensionReadme = path.join(root, 'extensions', 'telegram', 'README.md');
    const nodeModuleSource = path.join(nodeModuleDir, 'index.ts');

    writeFileSync(extensionEntry, 'export {};\n');
    writeFileSync(extensionSource, 'export {};\n');
    writeFileSync(extensionReadme, '# telegram\n');
    writeFileSync(nodeModuleSource, 'export {};\n');

    cleanupUnnecessaryFiles(root);

    expect(existsSync(extensionEntry)).toBe(true);
    expect(existsSync(extensionSource)).toBe(true);
    expect(existsSync(extensionReadme)).toBe(false);
    expect(existsSync(nodeModuleSource)).toBe(false);
  });
});
