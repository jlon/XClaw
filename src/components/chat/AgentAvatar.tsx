import { cn } from '@/lib/utils';
import { getAvatarLabel } from '@/lib/chat-avatar';

interface AgentAvatarProps {
  label: string;
  style: string;
  className?: string;
  textClassName?: string;
}

export function AgentAvatar({ label, style, className, textClassName }: AgentAvatarProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'chat-avatar-badge flex shrink-0 items-center justify-center rounded-full',
        style,
        className,
      )}
    >
      <span className={cn('font-semibold tracking-[-0.02em]', textClassName)}>
        {getAvatarLabel(label)}
      </span>
    </div>
  );
}
