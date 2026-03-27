import type { CSSProperties } from 'react';
import xclawWordmarkMask from '@/assets/xclaw-wordmark-mask.png';

export function XClawWelcomeWordmark() {
  return (
    <span className="app-chat-welcome-wordmark-mark" style={{ '--welcome-wordmark-mask': `url(${xclawWordmarkMask})` } as CSSProperties}>
      <span className="app-chat-welcome-wordmark-fallback" aria-hidden="true">
        <span className="app-chat-welcome-wordmark-fallback-x">X</span>
        <span className="app-chat-welcome-wordmark-fallback-claw">Claw</span>
      </span>
    </span>
  );
}
