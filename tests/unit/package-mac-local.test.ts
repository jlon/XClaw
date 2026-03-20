import { describe, expect, it } from 'vitest';

import {
  buildMacLocalBuilderArgs,
  MAC_ARCH_ARGS,
  LOCAL_COMPRESSION_ARGS,
  MIN_DARWIN_MAJOR_FOR_DMG,
  parseDarwinMajor,
  resolveMacLocalTargets,
} from '../../scripts/package-mac-local.mjs';

describe('package-mac-local', () => {
  it('parses the Darwin major version', () => {
    expect(parseDarwinMajor('21.6.0')).toBe(21);
    expect(parseDarwinMajor('24.4.0')).toBe(24);
  });

  it('falls back to zip-only on hosts below the dmg minimum', () => {
    expect(resolveMacLocalTargets({ platform: 'darwin', release: `${MIN_DARWIN_MAJOR_FOR_DMG - 1}.7.6` })).toEqual(['zip']);
  });

  it('keeps dmg and zip on supported macOS hosts', () => {
    expect(resolveMacLocalTargets({ platform: 'darwin', release: `${MIN_DARWIN_MAJOR_FOR_DMG}.1.0` })).toEqual(['dmg', 'zip']);
  });

  it('builds zip-only args with both mac architectures on older hosts', () => {
    expect(buildMacLocalBuilderArgs({ platform: 'darwin', release: `${MIN_DARWIN_MAJOR_FOR_DMG - 1}.7.6` })).toEqual([
      '--mac',
      'zip',
      ...MAC_ARCH_ARGS,
      ...LOCAL_COMPRESSION_ARGS,
      '--publish',
      'never',
    ]);
  });

  it('builds dmg and zip args with both mac architectures on supported hosts', () => {
    expect(buildMacLocalBuilderArgs({ platform: 'darwin', release: `${MIN_DARWIN_MAJOR_FOR_DMG}.0.0` })).toEqual([
      '--mac',
      'dmg',
      'zip',
      ...MAC_ARCH_ARGS,
      ...LOCAL_COMPRESSION_ARGS,
      '--publish',
      'never',
    ]);
  });

  it('rejects non-macOS hosts', () => {
    expect(() => resolveMacLocalTargets({ platform: 'win32', release: '10.0.26100' })).toThrow(
      'package:mac:local can only run on macOS',
    );
  });
});
