import { removeExecApproval, resolvePendingExecApproval } from '@/lib/exec-approval-queue';
import { useGatewayStore } from '@/stores/gateway';
import {
  formatApprovalCommandReply,
  formatApprovalCommandSyncNote,
  type ApprovalDecision,
} from './approval-command';

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
      reply: string;
      syncInjected: boolean;
      syncError: string | null;
    };

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

  let syncInjected = false;
  let syncError: string | null = null;

  try {
    await gatewayState.rpc('chat.inject', {
      sessionKey: transcriptSessionKey,
      message: formatApprovalCommandSyncNote(approvalSlug, params.decision),
    });
    syncInjected = true;
  } catch (error) {
    syncError = String(error);
  }

  return {
    ok: true,
    approvalId,
    approvalSlug,
    transcriptSessionKey,
    reply: formatApprovalCommandReply(approvalSlug, params.decision),
    syncInjected,
    syncError,
  };
}
