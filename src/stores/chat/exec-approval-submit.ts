import { removeExecApproval, resolvePendingExecApproval } from '@/lib/exec-approval-queue';
import { useGatewayStore } from '@/stores/gateway';
import { clearHistoryPoll, setHistoryPollTimer, setLastChatEventAt } from './helpers';
import type { ChatGet, ChatSet } from './store-api';
import { type ApprovalDecision } from './approval-command';

type SubmitExecApprovalDecisionParams = {
  requestedId: string;
  decision: ApprovalDecision;
  currentSessionKey: string;
};

type SubmitExecApprovalDecisionResult =
  | { ok: false; type: 'ambiguous'; message: string }
  | { ok: false; type: 'error'; message: string }
  | {
      ok: true;
      approvalId: string;
      approvalSlug: string;
      transcriptSessionKey: string;
      submittedAtMs: number;
    };

const APPROVAL_COMPLETION_POLL_START_MS = 350;
const APPROVAL_COMPLETION_POLL_INTERVAL_MS = 1500;
const APPROVAL_COMPLETION_TIMEOUT_MS = 45000;

export function beginAwaitingExecApprovalCompletion(
  set: ChatSet,
  get: ChatGet,
  submittedAtMs = Date.now(),
  targetSessionKey?: string,
): void {
  const resolvedSessionKey = targetSessionKey?.trim();
  if (resolvedSessionKey && resolvedSessionKey !== get().currentSessionKey) {
    get().switchSession(resolvedSessionKey);
  }
  clearHistoryPoll();
  setLastChatEventAt(submittedAtMs);
  set({
    sending: true,
    activeRunId: null,
    error: null,
    streamingText: '',
    streamingMessage: null,
    streamingTools: [],
    pendingFinal: true,
    lastUserMessageAt: submittedAtMs,
  });

  const pollHistory = async (): Promise<void> => {
    const state = get();
    if (resolvedSessionKey && state.currentSessionKey !== resolvedSessionKey) {
      clearHistoryPoll();
      return;
    }
    if (!state.sending || !state.pendingFinal) {
      clearHistoryPoll();
      return;
    }
    await state.loadHistory(true);
    const next = get();
    if (!next.sending || !next.pendingFinal) {
      clearHistoryPoll();
      return;
    }
    if (Date.now() - submittedAtMs >= APPROVAL_COMPLETION_TIMEOUT_MS) {
      clearHistoryPoll();
      set({
        sending: false,
        pendingFinal: false,
        error: 'Approved command is still running or did not report completion. Please retry or inspect the process output.',
      });
      return;
    }
    setHistoryPollTimer(setTimeout(() => {
      void pollHistory();
    }, APPROVAL_COMPLETION_POLL_INTERVAL_MS));
  };

  setHistoryPollTimer(setTimeout(() => {
    void pollHistory();
  }, APPROVAL_COMPLETION_POLL_START_MS));
}

export async function submitExecApprovalDecision(
  params: SubmitExecApprovalDecisionParams,
): Promise<SubmitExecApprovalDecisionResult> {
  const gatewayState = useGatewayStore.getState();
  const resolvedApproval = resolvePendingExecApproval(
    gatewayState.execApprovalQueue ?? [],
    params.requestedId,
    params.currentSessionKey,
  );

  if (resolvedApproval.kind === 'ambiguous') {
    const matches = resolvedApproval.entries.slice(0, 3).map((entry) => entry.slug).join(', ');
    const suffix = resolvedApproval.entries.length > 3 ? ` (+${resolvedApproval.entries.length - 3} more)` : '';
    return {
      ok: false,
      type: 'ambiguous',
      message: `Ambiguous approval id. Matches: ${matches}${suffix}. Use the full id.`,
    };
  }

  const approvalId = resolvedApproval.kind === 'match'
    ? resolvedApproval.entry.id
    : params.requestedId;
  const approvalSlug = resolvedApproval.kind === 'match'
    ? resolvedApproval.entry.slug
    : params.requestedId;
  const transcriptSessionKey = resolvedApproval.kind === 'match'
    ? resolvedApproval.entry.request.sessionKey?.trim() || params.currentSessionKey
    : params.currentSessionKey;

  try {
    await gatewayState.rpc('exec.approval.resolve', {
      id: approvalId,
      decision: params.decision,
    });
  } catch (error) {
    return {
      ok: false,
      type: 'error',
      message: `Failed to submit approval: ${String(error)}`,
    };
  }

  useGatewayStore.setState((state) => ({
    execApprovalQueue: removeExecApproval(state.execApprovalQueue, approvalId),
  }));

  return {
    ok: true,
    approvalId,
    approvalSlug,
    transcriptSessionKey,
    submittedAtMs: Date.now(),
  };
}
