import { cn } from '@/lib/utils';
import { buildAgentAvatarSpec } from '@/lib/agent-avatar';

interface AgentAvatarProps {
  agentId: string;
  size?: number;
  className?: string;
}

export function AgentAvatar({ agentId, size = 40, className }: AgentAvatarProps) {
  const spec = buildAgentAvatarSpec(agentId);
  const padding = Math.max(4, Math.round(size * 0.15));
  const gap = Math.max(1, Math.round(size * 0.045));
  const cellSize = (size - padding * 2 - gap * 4) / 5;

  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex shrink-0 overflow-hidden rounded-[14px] border shadow-[inset_0_1px_0_rgba(255,255,255,0.58)]',
        className,
      )}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderColor: spec.palette.border,
        backgroundColor: spec.palette.background,
      }}
    >
      <svg
        viewBox={`0 0 ${size} ${size}`}
        width={size}
        height={size}
        className="block h-full w-full"
        focusable="false"
      >
        <rect x="0" y="0" width={size} height={size} rx={size * 0.35} fill={spec.palette.background} />
        {spec.cells.map((row, rowIndex) =>
          row.map((tone, columnIndex) => {
            if (!tone) {
              return null;
            }

            const offset = padding + columnIndex * (cellSize + gap);
            const y = padding + rowIndex * (cellSize + gap);
            const x = offset;

            return (
              <rect
                key={`${rowIndex}-${columnIndex}`}
                x={x}
                y={y}
                width={cellSize}
                height={cellSize}
                rx={Math.max(1.2, cellSize * 0.22)}
                fill={((rowIndex + columnIndex) % 3 === 0 ? spec.palette.accent : spec.palette.foreground)}
              />
            );
          }),
        )}
      </svg>
    </span>
  );
}
