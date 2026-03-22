import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';

interface ChannelFocusWorkspaceProps {
  backLabel: string;
  title: string;
  description: string;
  icon: ReactNode;
  onBack: () => void;
  accountPane: ReactNode;
  editorPane: ReactNode;
}

export function ChannelFocusWorkspace({
  backLabel,
  title,
  description,
  icon,
  onBack,
  accountPane,
  editorPane,
}: ChannelFocusWorkspaceProps) {
  return (
    <section data-testid="channel-focus-workspace" className="space-y-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] border border-[hsl(var(--border-subtle)/0.7)] bg-[hsl(var(--surface-elevated)/0.98)] shadow-none">
            {icon}
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-[17px] font-semibold tracking-tight text-foreground">{title}</h2>
            <p className="mt-0.5 line-clamp-1 text-[11px] leading-5 text-muted-foreground/72">{description}</p>
          </div>
        </div>

        <button
          type="button"
          data-testid="channel-focus-back"
          aria-label={backLabel}
          title={backLabel}
          onClick={onBack}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-foreground/58 transition-colors hover:bg-[hsl(var(--foreground)/0.04)] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/18 focus-visible:ring-offset-0"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
      </div>

      <div
        data-testid="channel-focus-layout"
        className="grid min-w-0 gap-4 xl:grid-cols-[minmax(284px,0.86fr)_minmax(0,1.62fr)]"
      >
        <div data-testid="channel-focus-sidebar" className="min-w-0">
          {accountPane}
        </div>
        <div data-testid="channel-focus-editor" className="min-w-0">
          {editorPane}
        </div>
      </div>
    </section>
  );
}
