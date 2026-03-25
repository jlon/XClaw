import { useMemo, useState, type ReactNode } from 'react';
import { Plus, Search } from 'lucide-react';
import { AgentAvatar } from '@/components/agents/AgentAvatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { AgentSummary } from '@/types/agent';

export interface AgentListPaneProps {
  agents: AgentSummary[];
  selectedAgentId?: string | null;
  searchValue?: string;
  defaultSearchValue?: string;
  onSearchValueChange?: (value: string) => void;
  onSelectAgent: (agent: AgentSummary) => void;
  onCreateAgent?: () => void;
  groupBy?: (agent: AgentSummary) => string;
  groupLabel?: (groupKey: string, agents: AgentSummary[]) => ReactNode;
  searchPlaceholder?: string;
  createLabel?: string;
  defaultGroupLabel?: ReactNode;
  otherGroupLabel?: ReactNode;
  defaultBadgeLabel?: ReactNode;
  inheritedLabel?: ReactNode;
  unnamedLabel?: ReactNode;
  emptyStateTitle?: ReactNode;
  emptyStateDescription?: ReactNode;
  className?: string;
  listClassName?: string;
}

interface AgentListGroup {
  key: string;
  label: ReactNode;
  agents: AgentSummary[];
}

const DEFAULT_GROUP_KEY = '__default__';
const OTHER_GROUP_KEY = '__other__';

const defaultGroupBy = (agent: AgentSummary) =>
  agent.isDefault ? DEFAULT_GROUP_KEY : OTHER_GROUP_KEY;

const getDefaultGroupLabel = (groupKey: string) => {
  if (groupKey === DEFAULT_GROUP_KEY) {
    return '默认';
  }
  if (groupKey === OTHER_GROUP_KEY) {
    return '其他';
  }
  return groupKey;
};

const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFKC')
    .trim();

const getPathLeaf = (value?: string | null) => {
  const normalized = (value ?? '').replace(/[\\/]+$/, '');
  const segments = normalized.split(/[\\/]/).filter(Boolean);
  return segments.at(-1) || normalized;
};

const formatMetaLine = (agent: AgentSummary) => {
  const workspaceLeaf = getPathLeaf(agent.workspace);
  const modelLabel = (agent.modelDisplay ?? '').trim();

  if (modelLabel && workspaceLeaf && workspaceLeaf !== modelLabel) {
    return `${modelLabel} · ${workspaceLeaf}`;
  }

  return modelLabel || workspaceLeaf || agent.name || agent.id;
};

const matchesAgent = (agent: AgentSummary, query: string) => {
  if (!query) {
    return true;
  }

  const searchable = [
    agent.id,
    agent.name,
    agent.modelDisplay,
    agent.workspace,
    agent.agentDir,
    agent.mainSessionKey,
    agent.channelTypes.join(' '),
    agent.isDefault ? 'default' : '',
    agent.inheritedModel ? 'inherited' : '',
  ]
    .join(' ')
    .toLowerCase();

  return searchable.includes(query);
};

export function AgentListPane({
  agents,
  selectedAgentId = null,
  searchValue,
  defaultSearchValue = '',
  onSearchValueChange,
  onSelectAgent,
  onCreateAgent,
  groupBy = defaultGroupBy,
  groupLabel = getDefaultGroupLabel,
  searchPlaceholder = '搜索智能体、模型、工作区',
  createLabel = '新建智能体',
  defaultGroupLabel = '默认',
  otherGroupLabel = '其他',
  defaultBadgeLabel = '默认',
  inheritedLabel = '继承',
  unnamedLabel = '未命名智能体',
  emptyStateTitle,
  emptyStateDescription,
  className,
  listClassName,
}: AgentListPaneProps) {
  const [internalSearchValue, setInternalSearchValue] = useState(defaultSearchValue);
  const activeSearchValue = searchValue ?? internalSearchValue;
  const normalizedQuery = normalizeText(activeSearchValue);
  const hasQuery = normalizedQuery.length > 0;
  const customGrouping = groupBy !== defaultGroupBy;

  const groupedAgents = useMemo(() => {
    const filteredAgents = agents.filter((agent) => matchesAgent(agent, normalizedQuery));
    const groupedMap = new Map<string, AgentSummary[]>();

    filteredAgents.forEach((agent) => {
      const key = groupBy(agent);
      const items = groupedMap.get(key) ?? [];
      items.push(agent);
      groupedMap.set(key, items);
    });

    const entries = Array.from(groupedMap.entries());

    if (!customGrouping) {
      entries.sort((left, right) => {
        const order = (key: string) => {
          if (key === DEFAULT_GROUP_KEY) return 0;
          if (key === OTHER_GROUP_KEY) return 1;
          return 2;
        };

        return order(left[0]) - order(right[0]);
      });
    }

    return entries.map<AgentListGroup>(([key, items]) => ({
      key,
      label:
        key === DEFAULT_GROUP_KEY
          ? defaultGroupLabel
          : key === OTHER_GROUP_KEY
            ? otherGroupLabel
            : groupLabel(key, items),
      agents: items,
    }));
  }, [agents, customGrouping, defaultGroupLabel, groupBy, groupLabel, normalizedQuery, otherGroupLabel]);

  const handleSearchChange = (value: string) => {
    if (searchValue === undefined) {
      setInternalSearchValue(value);
    }

    onSearchValueChange?.(value);
  };

  const emptyTitle = emptyStateTitle ?? (hasQuery ? '没有匹配的智能体' : '还没有智能体');
  const emptyDescription =
    emptyStateDescription ??
    (hasQuery
      ? '换一个关键词，或者直接新建一个智能体。'
      : '你可以先新建一个智能体，或者从市场安装一个现成模板。');

  return (
    <section
      className={cn(
        'flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-border/60 bg-[hsl(var(--surface-elevated)/0.98)] text-foreground shadow-lg',
        className,
      )}
    >
      <div className="shrink-0 border-b border-border/55 px-4 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-md border border-border/65 bg-[hsl(var(--surface-panel)/0.98)] px-3.5 shadow-sm transition-colors focus-within:border-ring/50 focus-within:bg-[hsl(var(--surface-elevated)/1)]">
            <Search className="h-4 w-4 shrink-0 text-foreground/34" />
            <Input
              value={activeSearchValue}
              onChange={(event) => handleSearchChange(event.target.value)}
              placeholder={searchPlaceholder}
              className="h-8 border-0 bg-transparent px-0 text-[13px] text-foreground shadow-none outline-none ring-0 ring-offset-0 placeholder:text-foreground/34 focus-visible:border-0 focus-visible:bg-transparent focus-visible:ring-0"
            />
          </div>

          {onCreateAgent ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onCreateAgent}
              className="h-8 shrink-0 rounded-md border-border/65 bg-[hsl(var(--surface-panel)/0.96)] px-3.5 text-[13px] font-medium text-foreground/76 shadow-sm transition-colors hover:bg-[hsl(var(--surface-hover)/0.55)] hover:text-foreground cursor-default select-none"
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              {createLabel}
            </Button>
          ) : null}
        </div>
      </div>

      <div className={cn('min-h-0 flex-1 overflow-y-auto px-3 py-3', listClassName)}>
        {groupedAgents.length > 0 ? (
          <div className="space-y-4">
            {groupedAgents.map((group) => (
              <section key={group.key} className="space-y-2">
                <div className="flex items-center justify-between px-1.5 text-[11px] font-medium tracking-[0.04em] text-foreground/40">
                  <span>{group.label}</span>
                  <span>{group.agents.length}</span>
                </div>

                <div className="space-y-1.5">
                  {group.agents.map((agent) => {
                    const selected = agent.id === selectedAgentId;
                    return (
                      <button
                        key={agent.id}
                        type="button"
                        aria-selected={selected}
                        onClick={() => onSelectAgent(agent)}
                        className={cn(
                          'group flex w-full items-center gap-3 rounded-md border px-3 py-2.5 text-left transition-[background-color,border-color,box-shadow,transform] duration-150 ease-out',
                          selected
                            ? 'border-[hsl(var(--primary)/0.24)] bg-[hsl(var(--primary)/0.1)] shadow-none'
                            : 'border-transparent hover:border-border/55 hover:bg-[hsl(var(--surface-hover)/0.48)]',
                        )}
                      >
                        <AgentAvatar agentId={agent.id} profile={agent.avatarProfile} size={36} className="shrink-0" />

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-[13.5px] font-medium tracking-[-0.01em] text-foreground">
                              {agent.name || unnamedLabel}
                            </span>
                            {agent.isDefault ? (
                              <Badge
                                variant="outline"
                                className="h-5 rounded-full border-border/70 bg-[hsl(var(--surface-panel)/0.9)] px-2 text-[10px] font-medium text-foreground/64 shadow-none dark:bg-[hsl(var(--surface-elevated)/0.82)]"
                              >
                                {defaultBadgeLabel}
                              </Badge>
                            ) : null}
                          </div>

                          <p className="mt-0.5 truncate text-[12px] font-medium text-foreground/54">
                            {formatMetaLine(agent)}
                          </p>
                        </div>

                        <div className="flex shrink-0 flex-col items-end gap-1">
                          {agent.channelTypes.length > 0 ? (
                            <Badge
                              variant="secondary"
                              className="h-5 rounded-full border-border/60 bg-[hsl(var(--surface-panel)/0.9)] px-2 text-[10px] font-medium text-foreground/58 shadow-none"
                            >
                              {agent.channelTypes.length} 频道
                            </Badge>
                          ) : null}

                          {agent.inheritedModel ? (
                            <span className="text-[10px] font-medium tracking-[0.02em] text-foreground/34">
                              {inheritedLabel}
                            </span>
                          ) : null}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className="flex min-h-[240px] flex-col items-center justify-center rounded-xl border border-dashed border-border/50 bg-[hsl(var(--surface-panel)/0.6)] px-6 py-10 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border/60 bg-[hsl(var(--surface-elevated)/0.98)] text-foreground/34 shadow-none">
              <Search className="h-5 w-5" />
            </div>
            <div className="mt-4 space-y-1">
              <p className="text-[14px] font-medium text-foreground">{emptyTitle}</p>
              <p className="max-w-[260px] text-[12px] font-medium leading-[1.55] text-foreground/48">
                {emptyDescription}
              </p>
            </div>

            {onCreateAgent ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onCreateAgent}
                className="mt-5 h-8 rounded-md border-border/65 bg-[hsl(var(--surface-elevated)/0.98)] px-3.5 text-[13px] font-medium text-foreground/76 shadow-none hover:bg-[hsl(var(--surface-hover)/0.55)] hover:text-foreground"
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                {createLabel}
              </Button>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}
