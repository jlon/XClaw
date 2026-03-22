import type { CSSProperties } from 'react';
import xclawWordmarkMask from '@/assets/xclaw-wordmark-mask.png';

export function XClawWelcomeWordmark() {
  return <span className="app-chat-welcome-wordmark-mark" style={{ '--welcome-wordmark-mask': `url(${xclawWordmarkMask})` } as CSSProperties} />;
}
