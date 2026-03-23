import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AgentAvatar } from '@/components/agents/AgentAvatar';
import { buildAgentAvatarSpec } from '@/lib/agent-avatar';

describe('agent avatar', () => {
  it('builds a deterministic mirrored identicon from agent id', () => {
    const first = buildAgentAvatarSpec('pangtong');
    const second = buildAgentAvatarSpec('pangtong');
    const different = buildAgentAvatarSpec('wudaozi');

    expect(first.palette).toEqual(second.palette);
    expect(first.cells).toEqual(second.cells);
    expect(first.cells).not.toEqual(different.cells);
    first.cells.forEach((row) => {
      expect(row[0]).toBe(row[4]);
      expect(row[1]).toBe(row[3]);
    });
  });

  it('renders a compact svg avatar for agent cards', () => {
    const { container } = render(<AgentAvatar agentId="pangtong" />);

    expect(container.querySelector('svg')).toBeInTheDocument();
    expect(container.querySelectorAll('rect').length).toBeGreaterThan(1);
  });
});
