import { mkdir, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { testHome, testResourcesPath, mockLoggerWarn } = vi.hoisted(() => {
  const suffix = Math.random().toString(36).slice(2);
  return {
    testHome: `/tmp/XClaw-skills-provenance-${suffix}`,
    testResourcesPath: `/tmp/XClaw-skills-provenance-resources-${suffix}`,
    mockLoggerWarn: vi.fn(),
  };
});

vi.mock('os', async () => {
  const actual = await vi.importActual<typeof import('os')>('os');
  const mocked = {
    ...actual,
    homedir: () => testHome,
  };
  return {
    ...mocked,
    default: mocked,
  };
});

vi.mock('electron', () => ({
  app: {
    isPackaged: true,
  },
}));

vi.mock('@electron/utils/logger', () => ({
  warn: mockLoggerWarn,
  info: vi.fn(),
  error: vi.fn(),
}));

async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(join(path, '..'), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

describe('skill provenance helpers', () => {
  beforeEach(async () => {
    vi.resetAllMocks();
    vi.resetModules();
    await rm(testHome, { recursive: true, force: true });
    await rm(testResourcesPath, { recursive: true, force: true });
    await mkdir(join(testResourcesPath, 'resources', 'skills'), { recursive: true });
    Object.defineProperty(process, 'resourcesPath', {
      configurable: true,
      value: testResourcesPath,
    });
  });

  it('promotes preinstalled manifest + marker skills to xclaw-preinstalled', async () => {
    await writeJson(join(testResourcesPath, 'resources', 'skills', 'preinstalled-manifest.json'), {
      skills: [
        {
          slug: 'alpha-skill',
          version: '1.2.3',
          autoEnable: true,
        },
      ],
    });

    const markerPath = join(
      testHome,
      '.openclaw',
      'skills',
      'alpha-skill',
      '.XClaw-preinstalled.json',
    );
    await writeJson(markerPath, {
      source: 'XClaw-preinstalled',
      slug: 'alpha-skill',
      version: '1.2.3',
      installedAt: '2026-03-22T00:00:00.000Z',
    });

    const { readPreinstalledManifest, readPreinstalledMarker } = await import('@electron/utils/skill-config');
    const { resolveSkillProvenance, getSkillSourceLabel } = await import('@electron/utils/skill-provenance');

    const manifest = await readPreinstalledManifest();
    const marker = await readPreinstalledMarker(markerPath);
    const provenance = resolveSkillProvenance({
      slug: 'alpha-skill',
      source: 'openclaw-managed',
      manifestSkills: manifest,
      marker,
    });

    expect(manifest).toEqual([
      expect.objectContaining({
        slug: 'alpha-skill',
        version: '1.2.3',
        autoEnable: true,
      }),
    ]);
    expect(marker).toEqual(
      expect.objectContaining({
        source: 'XClaw-preinstalled',
        slug: 'alpha-skill',
        version: '1.2.3',
      }),
    );
    expect(provenance.source).toBe('xclaw-preinstalled');
    expect(provenance.displaySourceLabel).toBe('内置技能');
    expect(getSkillSourceLabel('xclaw-preinstalled')).toBe('内置技能');
  });

  it('keeps bundled distinct from the xclaw-preinstalled label', async () => {
    const { resolveSkillProvenance, getSkillSourceLabel } = await import('@electron/utils/skill-provenance');

    const provenance = resolveSkillProvenance({
      slug: 'bundled-skill',
      source: 'bundled',
      manifestSkills: [],
      marker: null,
    });

    expect(provenance.source).toBe('openclaw-bundled');
    expect(provenance.displaySourceLabel).not.toBe('内置技能');
    expect(getSkillSourceLabel('bundled')).not.toBe('内置技能');
  });

  it.each([
    ['openclaw-managed', '已安装'],
    ['openclaw-workspace', '工作区'],
    ['openclaw-extra', '额外目录'],
    ['agents-personal', 'Agent'],
    ['agents-project', 'Agent'],
  ] as const)('keeps %s as an independent provenance source', async (source, label) => {
    const { resolveSkillProvenance } = await import('@electron/utils/skill-provenance');

    const provenance = resolveSkillProvenance({
      slug: `skill-${source}`,
      source,
      manifestSkills: [],
      marker: null,
    });

    expect(provenance.source).toBe(source);
    expect(provenance.displaySourceLabel).toBe(label);
  });
});
