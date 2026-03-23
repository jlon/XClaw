import type { HTMLAttributes, PropsWithChildren } from 'react';
import { cn } from '@/lib/utils';

type WorkbenchHeaderIconTone = 'slate' | 'coral' | 'teal' | 'amber' | 'plum';

const toneClasses: Record<WorkbenchHeaderIconTone, string> = {
  slate: 'border-[#d9e1eb] bg-[linear-gradient(180deg,rgba(245,248,252,0.98)_0%,rgba(233,239,247,0.94)_100%)] text-[#6a7fa3]',
  coral: 'border-[#f1d7ce] bg-[linear-gradient(180deg,rgba(255,247,244,0.98)_0%,rgba(247,233,228,0.94)_100%)] text-[#d78169]',
  teal: 'border-[#d6e9e4] bg-[linear-gradient(180deg,rgba(245,251,249,0.98)_0%,rgba(232,243,240,0.94)_100%)] text-[#5a938a]',
  amber: 'border-[#efe1c6] bg-[linear-gradient(180deg,rgba(255,249,239,0.98)_0%,rgba(246,237,216,0.94)_100%)] text-[#b38a43]',
  plum: 'border-[#e8e0f0] bg-[linear-gradient(180deg,rgba(251,249,253,0.98)_0%,rgba(243,239,248,0.9)_100%)] text-[#8879ab]',
};

interface WorkbenchHeaderIconProps extends PropsWithChildren<HTMLAttributes<HTMLDivElement>> {
  tone?: WorkbenchHeaderIconTone;
}

export function WorkbenchHeaderIcon({
  children,
  tone = 'slate',
  className,
  ...props
}: WorkbenchHeaderIconProps) {
  return (
    <div
      data-testid="workbench-header-icon"
      className={cn('app-workbench-header-icon', toneClasses[tone], className)}
      {...props}
    >
      {children}
    </div>
  );
}
