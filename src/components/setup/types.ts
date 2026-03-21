import type { SetupMode } from '@/lib/setup-takeover';

export const SETUP_STAGE_ORDER = ['start', 'preparation', 'provider', 'complete'] as const;

export type SetupStage = (typeof SETUP_STAGE_ORDER)[number];

export type SetupCompletePhase = 'applying' | 'summary';

export type SetupLegacyStepId =
  | 'takeover'
  | 'welcome'
  | 'runtime'
  | 'provider'
  | 'providerReview'
  | 'installing'
  | 'complete';

export type SetupStageStatus = 'complete' | 'current' | 'upcoming';

export interface SetupStageLookupInput {
  mode: SetupMode;
  stepId: string;
  phase?: SetupCompletePhase;
}

export interface SetupActivationState {
  stage: SetupStage;
  phase?: SetupCompletePhase;
}
