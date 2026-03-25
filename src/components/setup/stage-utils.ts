import type { SetupMode } from '@/lib/setup-takeover';
import { SETUP_STAGE_ORDER, type SetupActivationState, type SetupLegacyStepId, type SetupStage, type SetupStageLookupInput } from './types';

const LEGACY_STEP_STAGE_MAP: Record<SetupLegacyStepId, SetupStage> = {
  takeover: 'start',
  welcome: 'start',
  runtime: 'preparation',
  provider: 'provider',
  providerReview: 'provider',
  installing: 'complete',
  complete: 'complete',
};

export const getSetupStageOrder = (): SetupStage[] => [...SETUP_STAGE_ORDER];

export const normalizeLegacySetupStepId = (stepId: string): SetupLegacyStepId | null => (
  stepId in LEGACY_STEP_STAGE_MAP ? (stepId as SetupLegacyStepId) : null
);

export const mapLegacySetupStepIdToStage = (stepId: string): SetupStage => {
  const normalizedStepId = normalizeLegacySetupStepId(stepId);

  return normalizedStepId ? LEGACY_STEP_STAGE_MAP[normalizedStepId] : 'complete';
};

export const mapSetupStateToStage = ({ stepId, phase }: SetupStageLookupInput): SetupStage => (
  phase ? 'complete' : mapLegacySetupStepIdToStage(stepId)
);

export const canActivateSetup = ({ stage, phase }: SetupActivationState): boolean => (
  stage === 'complete' && phase === 'summary'
);

export interface SetupPrimaryActionInput {
  stage: SetupStage;
  mode: SetupMode;
  phase?: 'enhancements' | 'applying' | 'summary';
  providerConfigured?: boolean;
  providerCanSubmit?: boolean;
  takeoverImportComplete?: boolean;
  takeoverNeedsProviderReview?: boolean;
  labels: {
    activate: string;
    takeoverImport: string;
    takeoverImportAndReview: string;
    reviewSummary: string;
    providerReview: string;
    providerSubmit: string;
    advance: string;
  };
}

export interface SetupPrimaryAction {
  intent: 'advance' | 'takeover-import' | 'provider-submit' | 'activate';
  label: string;
}

export const resolveSetupPrimaryAction = ({
  stage,
  mode,
  phase,
  providerConfigured = false,
  providerCanSubmit = false,
  takeoverImportComplete = false,
  takeoverNeedsProviderReview = false,
  labels,
}: SetupPrimaryActionInput): SetupPrimaryAction => {
  if (stage === 'complete' && (phase === 'summary' || phase === 'applying')) {
    return { intent: 'activate', label: labels.activate };
  }

  if (stage === 'preparation' && mode === 'takeover') {
    return {
      intent: 'takeover-import',
      label: takeoverImportComplete
        ? (takeoverNeedsProviderReview ? labels.providerReview : labels.reviewSummary)
        : (takeoverNeedsProviderReview ? labels.takeoverImportAndReview : labels.takeoverImport),
    };
  }

  if (stage === 'provider' && mode === 'fresh' && !providerConfigured && providerCanSubmit) {
    return { intent: 'provider-submit', label: labels.providerSubmit };
  }

  return { intent: 'advance', label: labels.advance };
};
