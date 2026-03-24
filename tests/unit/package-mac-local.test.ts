import { describe, expect, it } from 'vitest';

import {
  buildMacLocalBuilderArgs,
  resolveLocalElectronDist,
  resolveMacLocalArchArg,
  resolveMacLocalTargets,
} from '../../scripts/package-mac-local.mjs';

describe('package-mac-local', () => {
  it('always includes dmg alongside unpacked output on macOS hosts', () => {
    expect(resolveMacLocalTargets({ platform: 'darwin', release: '21.6.0' })).toEqual(['dir', 'dmg']);
    expect(resolveMacLocalTargets({ platform: 'darwin', release: '24.4.0' })).toEqual(['dir', 'dmg']);
  });

  it('builds local packaging args with dmg enabled by default', () => {
    expect(buildMacLocalBuilderArgs({ platform: 'darwin', release: '21.6.0' })).toEqual([
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

  it('allows retrying with dir-only targets after a dmg failure', () => {
    expect(buildMacLocalBuilderArgs({ platform: 'darwin', arch: 'x64', electronDist: null, targets: ['dir'] })).toEqual([
      '-c',
      'config/build/electron-builder.config.cjs',
      '--mac',
      'dir',
      '--x64',
      '--publish',
      'never',
      '-c.mac.notarize=false',
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
        release: '21.6.0',
        arch: 'x64',
        electronDist: null,
      }),
    ).toEqual([
      '-c',
      'config/build/electron-builder.config.cjs',
      '--mac',
      'dir',
      'dmg',
      '--x64',
      '--publish',
      'never',
      '-c.mac.notarize=false',
    ]);
  });

  it('rejects non-macOS hosts', () => {
    expect(() => resolveMacLocalTargets({ platform: 'win32', release: '10.0.26100' })).toThrow(
      'package:mac:local can only run on macOS',
    );
  });
});
