import { describe, expect, it } from 'vitest';

import {
  buildMacLocalBuilderArgs,
  MIN_DARWIN_MAJOR_FOR_DMG,
  parseDarwinMajor,
  resolveLocalElectronDist,
  resolveMacLocalArchArg,
  resolveMacLocalTargets,
} from '../../scripts/package-mac-local.mjs';

describe('package-mac-local', () => {
  it('parses the Darwin major version', () => {
    expect(parseDarwinMajor('21.6.0')).toBe(21);
    expect(parseDarwinMajor('24.4.0')).toBe(24);
  });

  it('falls back to zip-only on hosts below the dmg minimum', () => {
    expect(resolveMacLocalTargets({ platform: 'darwin', release: `${MIN_DARWIN_MAJOR_FOR_DMG - 1}.7.6` })).toEqual(['dir']);
  });

  it('keeps dmg alongside unpacked output on supported macOS hosts', () => {
    expect(resolveMacLocalTargets({ platform: 'darwin', release: `${MIN_DARWIN_MAJOR_FOR_DMG}.1.0` })).toEqual([
      'dir',
      'dmg',
    ]);
  });

  it('builds local packaging args with current host arch and local electron dist on older hosts', () => {
    expect(buildMacLocalBuilderArgs({ platform: 'darwin', release: `${MIN_DARWIN_MAJOR_FOR_DMG - 1}.7.6` })).toEqual([
      '-c',
      'config/build/electron-builder.config.cjs',
      '--mac',
      'dir',
      resolveMacLocalArchArg({ arch: process.arch }),
      '--publish',
      'never',
      '-c.mac.notarize=false',
      `-c.electronDist=${resolveLocalElectronDist()}`,
    ]);
  });

  it('adds dmg on supported hosts while keeping current host arch and local electron dist', () => {
    expect(buildMacLocalBuilderArgs({ platform: 'darwin', release: `${MIN_DARWIN_MAJOR_FOR_DMG}.0.0` })).toEqual([
      '-c',
      'config/build/electron-builder.config.cjs',
      '--mac',
      'dir',
      'dmg',
      resolveMacLocalArchArg({ arch: process.arch }),
      '--publish',
      'never',
      '-c.mac.notarize=false',
      `-c.electronDist=${resolveLocalElectronDist()}`,
    ]);
  });

  it('maps supported Node architectures to electron-builder arch flags', () => {
    expect(resolveMacLocalArchArg({ arch: 'x64' })).toBe('--x64');
    expect(resolveMacLocalArchArg({ arch: 'arm64' })).toBe('--arm64');
  });

  it('returns null when the local electron dist cannot be found', () => {
    expect(resolveLocalElectronDist({ candidatePath: '/definitely-missing-electron-dist' })).toBeNull();
  });

  it('omits the electronDist override when no local Electron distribution is available', () => {
    expect(
      buildMacLocalBuilderArgs({
        platform: 'darwin',
        release: `${MIN_DARWIN_MAJOR_FOR_DMG - 1}.7.6`,
        arch: 'x64',
        electronDist: null,
      }),
    ).toEqual(['-c', 'config/build/electron-builder.config.cjs', '--mac', 'dir', '--x64', '--publish', 'never', '-c.mac.notarize=false']);
  });

  it('rejects non-macOS hosts', () => {
    expect(() => resolveMacLocalTargets({ platform: 'win32', release: '10.0.26100' })).toThrow(
      'package:mac:local can only run on macOS',
    );
  });
});
