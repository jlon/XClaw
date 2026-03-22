import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AgentListPane } from '@/components/agents/AgentListPane';

describe('AgentListPane', () => {
  it('renders incomplete agent summaries without crashing', () => {
    const onSelectAgent = vi.fn();

    render(
      <AgentListPane
        agents={[
          {
            id: 'planner',
            name: 'Planner',
            isDefault: false,
            inheritedModel: false,
            workspace: undefined,
            agentDir: undefined,
            modelDisplay: undefined,
            mainSessionKey: undefined,
            channelTypes: [],
          } as never,
        ]}
        onSelectAgent={onSelectAgent}
      />,
    );

    expect(screen.getAllByText('Planner').length).toBeGreaterThan(0);
  });
});
