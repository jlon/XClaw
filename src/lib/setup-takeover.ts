import { hostApiFetch } from '@/lib/host-api';

export type SetupMode = 'fresh' | 'takeover';

export interface SetupInspectionSummary {
  bootstrap?: {
    setupComplete?: boolean;
    source?: 'main-settings' | 'legacy-footprint' | 'pending';
    readonly?: boolean;
    shouldRunStartupSideEffects?: boolean;
  };
  hasExistingOpenClaw: boolean;
  suggestedMode: SetupMode;
  gatewayPort?: number;
  openClawDir?: string;
  defaultWorkspacePath?: string;
  counts?: {
    runtimeProviders?: number;
    skills?: number;
    extensions?: number;
  };
  warnings?: string[];
}

export interface SetupPlanSummary {
  mode: SetupMode;
  canApply: boolean;
  blockingIssues: string[];
  warnings: string[];
  runtime?: {
    gatewayPort: number;
    portAvailable: boolean;
    suggestedGatewayPort: number;
    externalGatewayDetected: boolean;
    configChanging: boolean;
  };
  workspace?: {
    defaultPath: string;
    configuredPaths: string[];
  };
  providerImport?: {
    defaultRuntimeProviderKey: string | null;
    importableCount: number;
    conflictCount: number;
    unsupportedCount: number;
    requiresReview: boolean;
  };
}

export interface FreshSetupSummary {
  gatewayPort: number;
  workspacePath: string;
}

export interface TakeoverImportSummary {
  state: 'idle' | 'running' | 'blocked' | 'failed' | 'complete';
  step: string;
  importedAccountCount: number;
  defaultAccountId: string | null;
  warnings: string[];
  conflicts: string[];
  blockingIssues: string[];
  error?: string;
}

export interface SetupTakeoverState {
  inspection: SetupInspectionSummary;
  plans: {
    fresh: SetupPlanSummary | null;
    takeover: SetupPlanSummary | null;
  };
}

export const loadSetupTakeoverState = async (): Promise<SetupTakeoverState> => {
  const inspection = await hostApiFetch<SetupInspectionSummary>('/api/app/setup-inspection');
  const [takeover, fresh] = await Promise.all([
    inspection.hasExistingOpenClaw
      ? hostApiFetch<SetupPlanSummary>('/api/app/setup-plan', {
        method: 'POST',
        body: JSON.stringify({ mode: 'takeover' }),
      })
      : Promise.resolve(null),
    hostApiFetch<SetupPlanSummary>('/api/app/setup-plan', {
      method: 'POST',
      body: JSON.stringify({ mode: 'fresh' }),
    }),
  ]);

  return {
    inspection,
    plans: {
      fresh,
      takeover,
    },
  };
};

export const loadSetupPlan = async (
  mode: SetupMode,
  payload?: Partial<FreshSetupSummary>,
): Promise<SetupPlanSummary> => (
  hostApiFetch<SetupPlanSummary>('/api/app/setup-plan', {
    method: 'POST',
    body: JSON.stringify({
      mode,
      gatewayPort: payload?.gatewayPort,
      workspacePath: payload?.workspacePath,
    }),
  })
);

export const startTakeoverImport = async (): Promise<TakeoverImportSummary> => (
  hostApiFetch<TakeoverImportSummary>('/api/app/takeover-import', {
    method: 'POST',
    body: JSON.stringify({ mode: 'takeover' }),
  })
);

export const loadTakeoverImportStatus = async (): Promise<TakeoverImportSummary> => (
  hostApiFetch<TakeoverImportSummary>('/api/app/takeover-status')
);

export const activateSetupSession = async (
  payload?: {
    mode?: SetupMode;
    gatewayPort?: number;
    workspacePath?: string;
  },
): Promise<{ success: boolean }> => (
  hostApiFetch<{ success: boolean }>('/api/app/setup-activation', {
    method: 'POST',
    body: JSON.stringify(payload ?? {}),
  })
);
