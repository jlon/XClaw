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
        'inline-flex h-8 shrink-0 items-stretch rounded-md border border-border/70 bg-[hsl(var(--surface-elevated)/0.992)] p-1 shadow-sm',
        className,
      )}
    >
      <button
        type="button"
        onClick={() => onChange('agents')}
        aria-pressed={value === 'agents'}
        className={cn(
          'workbench-motion-button flex h-8 min-w-[88px] items-center justify-center gap-2 whitespace-nowrap rounded-[12px] px-3 text-[12.5px] font-medium tracking-[-0.01em]',
          value === 'agents'
            ? 'bg-[hsl(var(--surface-panel)/0.72)] text-foreground shadow-sm'
            : 'text-foreground/58 hover:text-foreground',
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
          'workbench-motion-button flex h-8 min-w-[88px] items-center justify-center gap-2 whitespace-nowrap rounded-[12px] px-3 text-[12.5px] font-medium tracking-[-0.01em]',
          value === 'market'
            ? 'bg-[hsl(var(--surface-panel)/0.72)] text-foreground shadow-sm'
            : 'text-foreground/58 hover:text-foreground',
        )}
      >
        <Store className="h-3.5 w-3.5 shrink-0" />
        {t('workbench.modes.market')}
      </button>
    </div>
  );
}
