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
        'flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-white shadow-[0_10px_24px_rgba(15,23,42,0.14)]',
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
