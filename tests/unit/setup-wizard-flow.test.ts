import { describe, expect, it } from 'vitest';
import {
  canActivateSetup,
  getSetupStageOrder,
  mapSetupStateToStage,
} from '@/components/setup/stage-utils';

describe('setup wizard flow model', () => {
  it('maps both fresh and takeover flows into the same four top-level stages', () => {
    expect(getSetupStageOrder()).toEqual(['start', 'preparation', 'provider', 'complete']);
    expect(mapSetupStateToStage({ mode: 'fresh', stepId: 'welcome' })).toBe('start');
    expect(mapSetupStateToStage({ mode: 'fresh', stepId: 'runtime' })).toBe('preparation');
    expect(mapSetupStateToStage({ mode: 'fresh', stepId: 'provider' })).toBe('provider');
    expect(mapSetupStateToStage({ mode: 'fresh', stepId: 'complete' })).toBe('complete');
    expect(mapSetupStateToStage({ mode: 'takeover', stepId: 'takeover' })).toBe('start');
    expect(mapSetupStateToStage({ mode: 'takeover', stepId: 'providerReview' })).toBe('provider');
  });

  it('only allows activation from the completion summary sub-state', () => {
    expect(canActivateSetup({ stage: 'start' })).toBe(false);
    expect(canActivateSetup({ stage: 'complete', phase: 'enhancements' })).toBe(false);
    expect(canActivateSetup({ stage: 'complete', phase: 'applying' })).toBe(false);
    expect(canActivateSetup({ stage: 'complete', phase: 'summary' })).toBe(true);
  });
});
