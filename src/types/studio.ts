import type { DetailedHTMLProps, HTMLAttributes } from 'react';

export type StudioRuntimeStatus =
  | 'idle'
  | 'starting'
  | 'ready'
  | 'error'
  | 'restarting'
  | 'stopping'
  | string;

export interface StudioRuntimeSnapshot {
  status?: StudioRuntimeStatus;
  resolvedUrl?: string | null;
  runtimeInstanceId?: string | number | null;
  lastError?: string | null;
  error?: string | null;
  message?: string | null;
  [key: string]: unknown;
}

export type StudioRuntimeEventPayload =
  | StudioRuntimeSnapshot
  | {
      runtime?: unknown;
      snapshot?: unknown;
      data?: unknown;
      [key: string]: unknown;
    };

export interface StudioSkinDescriptor {
  key: string;
  enabled: boolean;
  selectable: boolean;
  isDefaultFallback?: boolean;
}

export interface StudioSkinApplyResult {
  ok: boolean;
  appliedSkinKey: string | null;
  fallbackApplied: boolean;
  reason?: string | null;
  currentAppliedSkinKey?: string | null;
  refreshedAssets?: string[];
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      webview: DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
        src?: string;
        partition?: string;
        preload?: string;
        allowpopups?: boolean | string;
        webpreferences?: string;
        nodeintegration?: boolean | string;
        contextIsolation?: boolean | string;
        disablewebsecurity?: boolean | string;
        autoplaypolicy?: string;
      };
    }
  }
}

export {};
