import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AgentAvatar } from '@/components/agents/AgentAvatar';
import { buildAgentAvatarSpec } from '@/lib/agent-avatar';
import { buildAgentAvatarProfile } from '../../shared/agent-avatar-persona';

describe('agent avatar', () => {
  it('builds a semantic avatar when the profile has a confident role match', () => {
    const profile = buildAgentAvatarProfile({
      id: 'backend-builder',
      name: 'Backend Builder',
      role: 'API developer and database migration specialist',
      source: 'local',
    });

    const first = buildAgentAvatarSpec({ seed: 'backend-builder', profile });
    const second = buildAgentAvatarSpec({ seed: 'backend-builder', profile });

    expect(profile.archetype).toBe('builder');
    expect(profile.source).toBe('semantic');
    expect(first.kind).toBe('semantic');
    expect(first.dataUri).toBe(second.dataUri);
  });

  it('falls back to the legacy identicon when semantic evidence is missing', () => {
    const profile = buildAgentAvatarProfile({
      id: 'pangtong',
      name: 'Pangtong',
      source: 'local',
    });
    const differentProfile = buildAgentAvatarProfile({
      id: 'wudaozi',
      name: 'Wudaozi',
      source: 'local',
    });
    const first = buildAgentAvatarSpec({ seed: 'pangtong', profile });
    const second = buildAgentAvatarSpec({ seed: 'pangtong', profile });
    const different = buildAgentAvatarSpec({ seed: 'wudaozi', profile: differentProfile });

    expect(profile.source).toBe('fallback');
    expect(first.kind).toBe('fallback');
    expect(first.dataUri).toBe(second.dataUri);
    expect(first.dataUri).not.toBe(different.dataUri);
  });

  it('renders a data uri image for agent cards', () => {
    const profile = buildAgentAvatarProfile({
      id: 'researcher',
      name: 'Research Analyst',
      summary: 'Research and analysis for product discovery',
      source: 'market',
    });
    const { container } = render(<AgentAvatar agentId="researcher" profile={profile} />);

    const image = container.querySelector('img');
    expect(image).toBeInTheDocument();
    expect(image?.getAttribute('src')).toContain('data:image/svg+xml');
  });

  it('keeps same-archetype semantic avatars visually distinct across seeds', () => {
    const main = buildAgentAvatarProfile({
      id: 'main',
      name: 'Main Agent',
      sourceText: 'assistant helper guide',
      source: 'local',
    });
    const quotebot = buildAgentAvatarProfile({
      id: 'quotebot',
      name: 'Quotebot',
      sourceText: 'assistant helper guide',
      source: 'local',
    });

    const first = buildAgentAvatarSpec({ seed: 'main', profile: main });
    const second = buildAgentAvatarSpec({ seed: 'quotebot', profile: quotebot });

    expect(main.archetype).toBe('support');
    expect(quotebot.archetype).toBe('support');
    expect(first.kind).toBe('semantic');
    expect(second.kind).toBe('semantic');
    expect(first.dataUri).not.toBe(second.dataUri);
  });
});
