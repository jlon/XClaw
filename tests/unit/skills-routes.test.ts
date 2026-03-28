import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IncomingMessage, ServerResponse } from 'http';

const sendJsonMock = vi.fn();
const parseJsonBodyMock = vi.fn();
const readPreinstalledManifestMock = vi.fn();
const getAllSkillConfigsMock = vi.fn();
const readPreinstalledMarkerMock = vi.fn();
const updateSkillConfigMock = vi.fn();
const resolveSkillProvenanceMock = vi.fn();
const getOpenClawSkillsDirMock = vi.fn();
const normalizeClawHubCatalogItemMock = vi.fn();
const searchSkillHubSkillsMock = vi.fn();

vi.mock('@electron/api/route-utils', () => ({
  parseJsonBody: (...args: unknown[]) => parseJsonBodyMock(...args),
  sendJson: (...args: unknown[]) => sendJsonMock(...args),
}));

vi.mock('@electron/utils/skill-config', () => ({
  readPreinstalledManifest: (...args: unknown[]) => readPreinstalledManifestMock(...args),
  getAllSkillConfigs: (...args: unknown[]) => getAllSkillConfigsMock(...args),
  readPreinstalledMarker: (...args: unknown[]) => readPreinstalledMarkerMock(...args),
  updateSkillConfig: (...args: unknown[]) => updateSkillConfigMock(...args),
}));

vi.mock('@electron/utils/skill-provenance', () => ({
  resolveSkillProvenance: (...args: unknown[]) => resolveSkillProvenanceMock(...args),
}));

vi.mock('@electron/utils/paths', () => ({
  getOpenClawSkillsDir: (...args: unknown[]) => getOpenClawSkillsDirMock(...args),
}));

vi.mock('@electron/gateway/skillhub', () => ({
  normalizeClawHubCatalogItem: (...args: unknown[]) => normalizeClawHubCatalogItemMock(...args),
  searchSkillHubSkills: (...args: unknown[]) => searchSkillHubSkillsMock(...args),
}));

describe('handleSkillRoutes', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    parseJsonBodyMock.mockResolvedValue({});
    readPreinstalledManifestMock.mockResolvedValue([]);
    getAllSkillConfigsMock.mockResolvedValue({});
    readPreinstalledMarkerMock.mockResolvedValue(null);
    updateSkillConfigMock.mockResolvedValue({ success: true });
    resolveSkillProvenanceMock.mockReturnValue({
      source: 'user',
      displaySourceLabel: 'User',
    });
    getOpenClawSkillsDirMock.mockReturnValue('/tmp/openclaw/skills');
    normalizeClawHubCatalogItemMock.mockImplementation((value: unknown) => value);
    searchSkillHubSkillsMock.mockResolvedValue([]);
  });

  it('skips the clawhub installed-list fallback when gateway already returned skills', async () => {
    const { handleSkillRoutes } = await import('@electron/api/routes/skills');
    const listInstalled = vi.fn().mockResolvedValue([
      {
        slug: 'fallback-skill',
        version: '1.0.0',
        source: 'openclaw-managed',
        baseDir: '/tmp/openclaw/skills/fallback-skill',
      },
    ]);

    const handled = await handleSkillRoutes(
      { method: 'GET' } as IncomingMessage,
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/skills/catalog'),
      {
        gatewayManager: {
          rpc: vi.fn().mockResolvedValue({
            skills: [
              {
                skillKey: 'gateway-skill',
                slug: 'gateway-skill',
                name: 'Gateway Skill',
                description: 'fast path',
                disabled: false,
                version: '1.0.0',
                source: 'openclaw-managed',
                baseDir: '/tmp/openclaw/skills/gateway-skill',
              },
            ],
          }),
        },
        clawHubService: {
          listInstalled,
        },
      } as never,
    );

    expect(handled).toBe(true);
    expect(listInstalled).not.toHaveBeenCalled();
    expect(sendJsonMock).toHaveBeenCalledWith(expect.anything(), 200, {
      success: true,
      skills: [
        expect.objectContaining({
          id: 'gateway-skill',
          slug: 'gateway-skill',
          name: 'Gateway Skill',
          baseDir: '/tmp/openclaw/skills/gateway-skill',
        }),
      ],
    });
  });

  it('uses the clawhub installed-list fallback when gateway returns no skills', async () => {
    const { handleSkillRoutes } = await import('@electron/api/routes/skills');
    const listInstalled = vi.fn().mockResolvedValue([
      {
        slug: 'fallback-skill',
        version: '1.2.3',
        source: 'openclaw-managed',
        baseDir: '/tmp/openclaw/skills/fallback-skill',
      },
    ]);

    const handled = await handleSkillRoutes(
      { method: 'GET' } as IncomingMessage,
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/skills/catalog'),
      {
        gatewayManager: {
          rpc: vi.fn().mockResolvedValue({ skills: [] }),
        },
        clawHubService: {
          listInstalled,
        },
      } as never,
    );

    expect(handled).toBe(true);
    expect(listInstalled).toHaveBeenCalledTimes(1);
    expect(sendJsonMock).toHaveBeenCalledWith(expect.anything(), 200, {
      success: true,
      skills: [
        expect.objectContaining({
          id: 'fallback-skill',
          slug: 'fallback-skill',
          description: 'Recently installed, initializing...',
          baseDir: '/tmp/openclaw/skills/fallback-skill',
        }),
      ],
    });
  });
});
