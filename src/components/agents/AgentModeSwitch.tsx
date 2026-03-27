import { Grid2x2, Store } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

export type AgentBrowseMode = 'agents' | 'market';

export interface AgentModeSwitchProps {
  value: AgentBrowseMode;
  onChange: (mode: AgentBrowseMode) => void;
  className?: string;
}

export function AgentModeSwitch({ value, onChange, className }: AgentModeSwitchProps) {
  const { t } = useTranslation('agents');

  return (
    <div
      data-testid="agents-mode-switch"
      aria-label={t('subtitle')}
      className={cn(
        'inline-flex h-auto w-auto flex-wrap items-center rounded-[8px] border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-panel))] p-[2px] select-none',
        className,
      )}
    >
      <button
        type="button"
        onClick={() => onChange('agents')}
        aria-pressed={value === 'agents'}
        className={cn(
          'workbench-motion-button flex h-[30px] min-w-[88px] items-center justify-center gap-2 whitespace-nowrap rounded-[6px] px-3 text-[13px] font-semibold tracking-[-0.01em] cursor-default transition-[color,background-color,box-shadow,border-color] duration-200 ease-out border border-transparent shadow-none',
          value === 'agents'
            ? 'bg-[hsl(var(--surface-base))] text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground bg-transparent',
        )}
      >
        <Grid2x2 className="h-3.5 w-3.5 shrink-0" />
        {t('workbench.modes.agents')}
      </button>
      <button
        type="button"
        onClick={() => onChange('market')}
        aria-pressed={value === 'market'}
        className={cn(
          'workbench-motion-button flex h-[30px] min-w-[88px] items-center justify-center gap-2 whitespace-nowrap rounded-[6px] px-3 text-[13px] font-semibold tracking-[-0.01em] cursor-default transition-[color,background-color,box-shadow,border-color] duration-200 ease-out border border-transparent shadow-none',
          value === 'market'
            ? 'bg-[hsl(var(--surface-base))] text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground bg-transparent',
        )}
      >
        <Store className="h-3.5 w-3.5 shrink-0" />
        {t('workbench.modes.market')}
      </button>
    </div>
  );
}
