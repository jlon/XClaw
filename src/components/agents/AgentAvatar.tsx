import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { buildAgentAvatarSpec } from '@/lib/agent-avatar';
import type { AgentAvatarProfile } from '../../../shared/agent-avatar-persona';

interface AgentAvatarProps {
  agentId: string;
  profile?: AgentAvatarProfile | null;
  size?: number;
  className?: string;
}

export function AgentAvatar({ agentId, profile, size = 40, className }: AgentAvatarProps) {
  const { i18n } = useTranslation();
  const spec = buildAgentAvatarSpec({ seed: agentId, profile, locale: i18n.language });

  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex shrink-0 overflow-hidden rounded-md border shadow-sm',
        className,
      )}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderColor: spec.frame.border,
        backgroundColor: spec.frame.background,
      }}
    >
      <img
        alt=""
        src={spec.dataUri}
        width={size}
        height={size}
        className="block h-full w-full"
        draggable={false}
      />
    </span>
  );
}
