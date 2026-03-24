import { beforeEach, describe, expect, it, vi } from 'vitest';
import bundledTemplates from '@electron/shared/agent-market-templates.json';

const createAgentWithIdMock = vi.fn();
const deleteAgentConfigMock = vi.fn();
const removeAgentWorkspaceDirectoryMock = vi.fn();
const writeAgentWorkspaceFileContentMock = vi.fn();

vi.mock('@electron/utils/agent-config', () => ({
  createAgentWithId: (...args: unknown[]) => createAgentWithIdMock(...args),
  deleteAgentConfig: (...args: unknown[]) => deleteAgentConfigMock(...args),
  removeAgentWorkspaceDirectory: (...args: unknown[]) => removeAgentWorkspaceDirectoryMock(...args),
  writeAgentWorkspaceFileContent: (...args: unknown[]) => writeAgentWorkspaceFileContentMock(...args),
}));

describe('agent market install', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    createAgentWithIdMock.mockResolvedValue({
      snapshot: { agents: [], defaultAgentId: 'main', configuredChannelTypes: [], channelOwners: {}, channelAccountOwners: {} },
      createdAgentId: 'planner',
    });
    deleteAgentConfigMock.mockResolvedValue({
      snapshot: { agents: [], defaultAgentId: 'main', configuredChannelTypes: [], channelOwners: {}, channelAccountOwners: {} },
      removedEntry: { id: 'planner', workspace: '~/.openclaw/workspace-planner' },
    });
    removeAgentWorkspaceDirectoryMock.mockResolvedValue(undefined);
    writeAgentWorkspaceFileContentMock.mockResolvedValue(undefined);
  });

  it('installs a catalog agent and writes SOUL.md into the new workspace', async () => {
    const { installAgentFromCatalog } = await import('@electron/utils/agent-market');
    const result = await installAgentFromCatalog('daily-standup', 'Planner');

    expect(createAgentWithIdMock).toHaveBeenCalledWith('Planner', { bootstrapMode: 'empty' });
    expect(writeAgentWorkspaceFileContentMock).toHaveBeenCalledWith('planner', 'SOUL.md', bundledTemplates['daily-standup']);
    expect(deleteAgentConfigMock).not.toHaveBeenCalled();
    expect(removeAgentWorkspaceDirectoryMock).not.toHaveBeenCalled();
    expect(result.createdAgentId).toBe('planner');
  });

  it('enriches catalog items with semantic avatar profiles', async () => {
    const { listAgentMarketCatalog } = await import('@electron/utils/agent-market');
    const catalog = await listAgentMarketCatalog();
    const item = catalog.items.find((entry) => entry.id === 'daily-standup');

    expect(item?.avatarProfile).toMatchObject({
      archetype: 'strategist',
      source: 'semantic',
      tone: 'slate',
    });
  });

  it('rolls back the created agent when writing SOUL.md fails', async () => {
    writeAgentWorkspaceFileContentMock.mockRejectedValueOnce(new Error('disk full'));

    const { installAgentFromCatalog } = await import('@electron/utils/agent-market');

    await expect(installAgentFromCatalog('daily-standup', 'Planner')).rejects.toThrow('disk full');
    expect(deleteAgentConfigMock).toHaveBeenCalledWith('planner');
    expect(removeAgentWorkspaceDirectoryMock).toHaveBeenCalledWith({
      id: 'planner',
      workspace: '~/.openclaw/workspace-planner',
    });
  });
});
