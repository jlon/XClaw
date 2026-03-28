/**
 * Chat Page
 * Native React implementation communicating with OpenClaw Gateway
 * via gateway:rpc IPC. Session selector, thinking toggle, and refresh
 * are in the toolbar; messages render with markdown + streaming.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Loader2, X } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AgentAvatar } from '@/components/agents/AgentAvatar';
import { useChatStore, type RawMessage } from '@/stores/chat';
import { useGatewayStore } from '@/stores/gateway';
import { useAgentsStore } from '@/stores/agents';
import { useSkillsStore } from '@/stores/skills';
import { useSettingsStore } from '@/stores/settings';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { extractImages, extractText, extractThinking, extractToolUse, isSystemRuntimeMessage } from './message-utils';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { generateUuid } from '@/lib/uuid';
import { useStickToBottomInstant } from '@/hooks/use-stick-to-bottom-instant';
import { XClawWelcomeWordmark } from '@/components/common/XClawWelcomeWordmark';
import { hostApiFetch } from '@/lib/host-api';
import { buildChatExportFileName, buildChatMarkdown } from './export-markdown';
import { ExecApprovalOverlay } from './ExecApprovalOverlay';
import { submitExecApprovalDecision } from '@/stores/chat/exec-approval-submit';
import type { AgentSummary } from '@/types/agent';
import type { SkillChatDraft } from '@/types/skill';

const messageVisualRole = (message: RawMessage, showThinking: boolean): 'assistant' | 'user' | null => {
  if (isSystemRuntimeMessage(message)) return null;
  const role = typeof message.role === 'string' ? message.role.toLowerCase() : '';
  if (role === 'toolresult' || role === 'tool_result') return null;
  const hasText = extractText(message).trim().length > 0;
  const hasThinking = showThinking && !!extractThinking(message)?.trim();
  const hasImages = extractImages(message).length > 0;
  const hasTools = extractToolUse(message).length > 0;
  const hasAttachedFiles = (message._attachedFiles?.length ?? 0) > 0;
  if (!hasText && !hasThinking && !hasImages && !hasTools && !hasAttachedFiles) return null;
  return role === 'user' ? 'user' : 'assistant';
};

const messagesMatchForDisplay = (left: RawMessage | null, right: RawMessage | null, showThinking: boolean): boolean => {
  if (!left || !right) return false;
  const leftRole = typeof left.role === 'string' ? left.role.toLowerCase() : 'assistant';
  const rightRole = typeof right.role === 'string' ? right.role.toLowerCase() : 'assistant';
  if (leftRole !== 'assistant' || rightRole !== 'assistant') return false;

  const leftText = extractText(left).trim();
  const rightText = extractText(right).trim();
  const leftThinking = showThinking ? (extractThinking(left)?.trim() ?? '') : '';
  const rightThinking = showThinking ? (extractThinking(right)?.trim() ?? '') : '';
  const leftTools = JSON.stringify(extractToolUse(left));
  const rightTools = JSON.stringify(extractToolUse(right));
  const leftImages = extractImages(left).length;
  const rightImages = extractImages(right).length;
  const leftFiles = left._attachedFiles?.length ?? 0;
  const rightFiles = right._attachedFiles?.length ?? 0;

  return leftText === rightText
    && leftThinking === rightThinking
    && leftTools === rightTools
    && leftImages === rightImages
    && leftFiles === rightFiles;
};

const stackSpacingClass = (isClusteredWithPrevious: boolean, isFirst: boolean) =>
  isFirst ? 'mt-0' : isClusteredWithPrevious ? 'mt-1.5' : 'mt-3';

const welcomeCardClassNames = {
  execution: 'app-chat-welcome-card--execution',
  continuation: 'app-chat-welcome-card--continuation',
  orchestration: 'app-chat-welcome-card--orchestration',
  integration: 'app-chat-welcome-card--integration',
} as const;

type SkillFlowPhase = 'draft' | 'sent' | 'submitted';

export function Chat() {
  const { t } = useTranslation('chat');
  const location = useLocation();
  const navigate = useNavigate();
  const isWindows = window.electron?.platform === 'win32';
  const gatewayStatus = useGatewayStore((s) => s.status);
  const execApprovalQueue = useGatewayStore((s) => s.execApprovalQueue);
  const isGatewayRunning = gatewayStatus.state === 'running';

  const messages = useChatStore((s) => s.messages);
  const currentSessionKey = useChatStore((s) => s.currentSessionKey);
  const currentAgentId = useChatStore((s) => s.currentAgentId);
  const sessions = useChatStore((s) => s.sessions);
  const sessionLabels = useChatStore((s) => s.sessionLabels);
  const loading = useChatStore((s) => s.loading);
  const sending = useChatStore((s) => s.sending);
  const lastUserMessageAt = useChatStore((s) => s.lastUserMessageAt);
  const error = useChatStore((s) => s.error);
  const showThinking = useChatStore((s) => s.showThinking);
  const streamingMessage = useChatStore((s) => s.streamingMessage);
  const streamingTools = useChatStore((s) => s.streamingTools);
  const pendingFinal = useChatStore((s) => s.pendingFinal);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const abortRun = useChatStore((s) => s.abortRun);
  const clearError = useChatStore((s) => s.clearError);
  const pendingSlashAction = useChatStore((s) => ('pendingSlashAction' in s ? s.pendingSlashAction : null));
  const agents = useAgentsStore((s) => s.agents);

  const cleanupEmptySession = useChatStore((s) => s.cleanupEmptySession);

  const [showScrollToLatest, setShowScrollToLatest] = useState(false);
  const [hasPendingLatest, setHasPendingLatest] = useState(false);
  const [draftSeed, setDraftSeed] = useState('');
  const [draftSeedVersion, setDraftSeedVersion] = useState(0);
  const [pendingSkillDraft, setPendingSkillDraft] = useState<SkillChatDraft | null>(null);
  const [skillFlowState, setSkillFlowState] = useState<{ draft: SkillChatDraft; phase: SkillFlowPhase } | null>(null);
  const [execApprovalBusy, setExecApprovalBusy] = useState(false);
  const [execApprovalError, setExecApprovalError] = useState<{ approvalId: string; message: string } | null>(null);
  const isHistoryLoading = loading && messages.length === 0;
  const { contentRef, scrollRef } = useStickToBottomInstant(currentSessionKey);
  const isNearBottomRef = useRef(true);
  const consumedDraftLocationRef = useRef<string | null>(null);

  const routeDraft = (() => {
    const state = location.state;
    if (!state || typeof state !== 'object' || !('skillChatDraft' in state)) {
      return null;
    }
    const draft = (state as { skillChatDraft?: SkillChatDraft | null }).skillChatDraft;
    if (!draft || typeof draft !== 'object' || typeof draft.message !== 'string') {
      return null;
    }
    return draft;
  })();

  // Load data when gateway is running.
  // When the store already holds messages for this session (i.e. the user
  // is navigating *back* to Chat), use quiet mode so the existing messages
  // stay visible while fresh data loads in the background.  This avoids
  // an unnecessary messages → spinner → messages flicker.
  useEffect(() => {
    return () => {
      // If the user navigates away without sending any messages, remove the
      // empty session so it doesn't linger as a ghost entry in the sidebar.
      cleanupEmptySession();
    };
  }, [cleanupEmptySession]);

  useEffect(() => {
    void useAgentsStore.getState().fetchAgents();
  }, []);

  useEffect(() => {
    if (!routeDraft) return;
    if (consumedDraftLocationRef.current === location.key) return;
    setDraftSeed(routeDraft.message);
    setDraftSeedVersion((version) => version + 1);
    setPendingSkillDraft(routeDraft);
    setSkillFlowState({ draft: routeDraft, phase: 'draft' });
    consumedDraftLocationRef.current = location.key;
  }, [location.key, routeDraft]);

  // Update timestamp when sending starts
  const streamMsg = streamingMessage && typeof streamingMessage === 'object'
    ? streamingMessage as unknown as { role?: string; content?: unknown; timestamp?: number }
    : null;
  const streamText = streamMsg ? extractText(streamMsg) : (typeof streamingMessage === 'string' ? streamingMessage : '');
  const hasStreamText = streamText.trim().length > 0;
  const streamThinking = streamMsg ? extractThinking(streamMsg) : null;
  const hasStreamThinking = showThinking && !!streamThinking && streamThinking.trim().length > 0;
  const streamTools = streamMsg ? extractToolUse(streamMsg) : [];
  const hasStreamTools = streamTools.length > 0;
  const streamImages = streamMsg ? extractImages(streamMsg) : [];
  const hasStreamImages = streamImages.length > 0;
  const hasStreamToolStatus = streamingTools.length > 0;
  const shouldRenderStreaming = sending && (hasStreamText || hasStreamThinking || hasStreamTools || hasStreamImages || hasStreamToolStatus);
  const hasAnyStreamContent = hasStreamText || hasStreamThinking || hasStreamTools || hasStreamImages || hasStreamToolStatus;
  const activeSession = sessions.find((session) => session.key === currentSessionKey);
  const currentAgent = useMemo(
    () => agents.find((agent) => agent.id === currentAgentId) ?? null,
    [agents, currentAgentId],
  );
  const currentAgentName = currentAgent?.name || currentAgentId;
  const currentSessionLabel = sessionLabels[currentSessionKey] ?? activeSession?.label ?? activeSession?.displayName ?? currentAgentName;
  const assistantAvatar = useMemo<Pick<AgentSummary, 'id' | 'name' | 'avatarProfile'>>(() => ({
    id: currentAgentId || 'main',
    name: currentAgentName || 'Assistant',
    avatarProfile: currentAgent?.avatarProfile,
  }), [currentAgent, currentAgentId, currentAgentName]);
  const handleSendSkillDraft = useCallback(async (draft: SkillChatDraft, text: string) => {
    if (draft.execution.kind !== 'host-install') {
      setSkillFlowState({ draft, phase: 'sent' });
      setPendingSkillDraft(null);
      return false;
    }

    const payload = draft.execution.payload;
    const slug = typeof payload.slug === 'string' ? payload.slug : draft.slug;
    const version = typeof payload.version === 'string' ? payload.version : undefined;
    if (!slug) {
      useChatStore.setState({ error: 'Invalid skill install draft: missing slug.' });
      setPendingSkillDraft(null);
      return true;
    }

    const now = Date.now();
    const userMessage: RawMessage = {
      role: 'user',
      content: text,
      timestamp: now / 1000,
      id: generateUuid(),
    };

    useChatStore.setState((state) => ({
      sending: true,
      error: null,
      messages: [...state.messages, userMessage],
      sessionLabels: state.sessionLabels[state.currentSessionKey]
        ? state.sessionLabels
        : { ...state.sessionLabels, [state.currentSessionKey]: draft.name || text.slice(0, 72) },
      sessionLastActivity: { ...state.sessionLastActivity, [state.currentSessionKey]: now },
    }));

    try {
      const result = await hostApiFetch<{ success: boolean; error?: string }>('/api/clawhub/install', {
        method: 'POST',
        body: JSON.stringify({ slug, version }),
      });
      if (!result.success) {
        throw new Error(result.error || 'Install failed');
      }
      await useSkillsStore.getState().fetchSkills();
      setSkillFlowState({ draft, phase: 'submitted' });
      useChatStore.setState((state) => ({
        sending: false,
        messages: [
          ...state.messages,
          {
            role: 'assistant',
            content: `已提交 ${draft.name || slug} 的安装请求。安装完成后可以回到技能页继续管理。`,
            timestamp: Date.now() / 1000,
            id: generateUuid(),
          },
        ],
        sessionLastActivity: { ...state.sessionLastActivity, [state.currentSessionKey]: Date.now() },
      }));
    } catch (error) {
      setSkillFlowState({ draft, phase: 'draft' });
      useChatStore.setState((state) => ({
        sending: false,
        error: String(error),
        messages: [
          ...state.messages,
          {
            role: 'assistant',
            content: `安装 ${draft.name || slug} 失败：${String(error)}`,
            timestamp: Date.now() / 1000,
            id: generateUuid(),
          },
        ],
        sessionLastActivity: { ...state.sessionLastActivity, [state.currentSessionKey]: Date.now() },
      }));
    } finally {
      setPendingSkillDraft(null);
    }

    return true;
  }, []);
  const skillFlowRailCopy = useMemo(() => {
    if (!skillFlowState?.draft.returnContext) {
      return null;
    }
    const draftName = skillFlowState.draft.name || skillFlowState.draft.title;
    const sourceLabel = skillFlowState.draft.providerId === 'skillhub'
      ? 'SkillHub'
      : skillFlowState.draft.providerId === 'clawhub'
        ? 'ClawHub'
        : t('skillFlow.skillsCenter', { defaultValue: '技能中心' });
    const title = skillFlowState.phase === 'submitted'
      ? t('skillFlow.submittedTitle', { name: draftName, defaultValue: `${draftName} 的安装请求已提交` })
      : skillFlowState.phase === 'sent'
        ? t('skillFlow.sentTitle', { name: draftName, defaultValue: `${draftName} 的安装草案已发到当前线程` })
        : t('skillFlow.readyTitle', { name: draftName, defaultValue: `${draftName} 的安装草案已就位` });
    const description = skillFlowState.phase === 'submitted'
      ? t('skillFlow.submittedDescription', { defaultValue: '安装完成后可回到技能页查看、启停或继续管理。' })
      : skillFlowState.phase === 'sent'
        ? t('skillFlow.sentDescription', { defaultValue: '草案已经发到这条线程，处理完后仍可回到技能页继续筛选。' })
        : t('skillFlow.readyDescription', { defaultValue: '确认后就从当前线程继续安装，需要时随时回到技能页。' });
    return { sourceLabel, title, description };
  }, [skillFlowState, t]);
  const handleReturnToSkills = useCallback(() => {
    if (!skillFlowState?.draft.returnContext) {
      return;
    }
    navigate('/skills');
  }, [navigate, skillFlowState]);
  const renderedMessages = useMemo(() => {
    const visibleMessages: Array<{
      idx: number;
      message: RawMessage;
      visualRole: 'assistant' | 'user';
      showAvatar?: boolean;
      isClusteredWithPrevious?: boolean;
    }> = [];
    for (const [idx, message] of messages.entries()) {
      const visualRole = messageVisualRole(message, showThinking);
      if (!visualRole) continue;
      visibleMessages.push({ idx, message, visualRole });
    }
    for (const [visibleIndex, entry] of visibleMessages.entries()) {
      const previousRole = visibleMessages[visibleIndex - 1]?.visualRole ?? null;
      entry.showAvatar = entry.visualRole !== 'assistant' || previousRole !== 'assistant';
      entry.isClusteredWithPrevious = previousRole === entry.visualRole;
    }
    return visibleMessages as Array<{
      idx: number;
      message: RawMessage;
      visualRole: 'assistant' | 'user';
      showAvatar: boolean;
      isClusteredWithPrevious: boolean;
    }>;
  }, [messages, showThinking]);
  const lastVisibleRole = renderedMessages.at(-1)?.visualRole ?? null;
  const nextAssistantAvatarVisible = lastVisibleRole !== 'assistant';
  const nextAssistantClustered = lastVisibleRole === 'assistant';
  const nextAssistantSpacingClass = stackSpacingClass(nextAssistantClustered, renderedMessages.length === 0);
  const lastRenderedAssistantMessage = renderedMessages.length > 0 && renderedMessages.at(-1)?.visualRole === 'assistant'
    ? renderedMessages.at(-1)?.message ?? null
    : null;
  const streamingDuplicatesLastAssistant = streamMsg
    ? messagesMatchForDisplay(
        lastRenderedAssistantMessage,
        {
          ...(streamMsg as Record<string, unknown>),
          role: (typeof streamMsg.role === 'string' ? streamMsg.role : 'assistant') as RawMessage['role'],
          content: streamMsg.content ?? streamText,
          timestamp: streamMsg.timestamp,
        } as RawMessage,
        showThinking,
      )
    : false;
  const composerErrorCopy = error
    ? (/timed out/i.test(error) ? t('errors.requestTimeout') : error)
    : null;
  const syncScrollAffordance = useCallback(() => {
    const scrollElement = scrollRef.current;
    if (!scrollElement) return;
    const distanceToBottom = scrollElement.scrollHeight - scrollElement.scrollTop - scrollElement.clientHeight;
    const shouldShow = distanceToBottom > 180;
    isNearBottomRef.current = !shouldShow;
    setShowScrollToLatest(shouldShow);
    if (!shouldShow) {
      setHasPendingLatest(false);
    }
  }, [scrollRef]);

  const isEmpty = messages.length === 0 && !sending && !loading;

  useEffect(() => {
    const scrollElement = scrollRef.current;
    if (!scrollElement) return;
    syncScrollAffordance();
    const handleScroll = () => {
      syncScrollAffordance();
    };
    scrollElement.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll);
    return () => {
      scrollElement.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, [scrollRef, syncScrollAffordance]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      syncScrollAffordance();
      if (!isNearBottomRef.current && (messages.length > 0 || shouldRenderStreaming)) {
        setHasPendingLatest(true);
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [messages.length, shouldRenderStreaming, syncScrollAffordance]);

  const scrollToLatest = useCallback(() => {
    const scrollElement = scrollRef.current;
    if (!scrollElement) return;
    scrollElement.scrollTop = scrollElement.scrollHeight;
    isNearBottomRef.current = true;
    setShowScrollToLatest(false);
    setHasPendingLatest(false);
  }, [scrollRef]);
  const stickComposerFlowToBottom = useCallback(() => {
    const scrollElement = scrollRef.current;
    if (!scrollElement) return;
    scrollElement.scrollTop = scrollElement.scrollHeight;
    isNearBottomRef.current = true;
    setShowScrollToLatest(false);
    setHasPendingLatest(false);
  }, [scrollRef]);
  const scrollChromeClass = isEmpty
    ? (isWindows ? 'subtle-scrollbar-win' : 'subtle-scrollbar')
    : (isWindows ? 'workspace-page-scroll-win' : 'workspace-page-scroll-default');
  const activeExecApproval = useMemo(() => {
    if (execApprovalQueue.length === 0) {
      return null;
    }
    return execApprovalQueue.find((entry) => entry.request.sessionKey === currentSessionKey)
      ?? execApprovalQueue[0]
      ?? null;
  }, [currentSessionKey, execApprovalQueue]);

  useEffect(() => {
    if (!pendingSlashAction) return;

    useChatStore.setState({ pendingSlashAction: null });

    if (pendingSlashAction.kind === 'toggle-focus') {
      const settingsState = useSettingsStore.getState();
      const nextChatFocusMode = !('chatFocusMode' in settingsState ? settingsState.chatFocusMode : false);
      ('setChatFocusMode' in settingsState ? settingsState.setChatFocusMode : (() => undefined))(nextChatFocusMode);
      return;
    }

    if (pendingSlashAction.kind === 'export') {
      const title = currentSessionLabel || currentAgentName || 'Chat';
      const markdown = buildChatMarkdown({
        title,
        assistantName: assistantAvatar.name,
        messages,
      });
      void hostApiFetch('/api/files/save-text', {
        method: 'POST',
        body: JSON.stringify({
          defaultFileName: buildChatExportFileName(title),
          content: markdown,
        }),
      }).catch((error) => {
        useChatStore.setState({ error: String(error) });
      });
    }
  }, [
    assistantAvatar.name,
    currentAgentName,
    currentSessionLabel,
    messages,
    pendingSlashAction,
  ]);

  useEffect(() => {
    if (!lastUserMessageAt) return;
    const frame = requestAnimationFrame(() => {
      stickComposerFlowToBottom();
    });
    return () => cancelAnimationFrame(frame);
  }, [lastUserMessageAt, stickComposerFlowToBottom]);

  useEffect(() => {
    if (!sending || !isNearBottomRef.current) return;
    const frame = requestAnimationFrame(() => {
      stickComposerFlowToBottom();
    });
    return () => cancelAnimationFrame(frame);
  }, [messages.length, pendingFinal, sending, shouldRenderStreaming, stickComposerFlowToBottom]);

  const handleExecApprovalDecision = useCallback(async (decision: 'allow-once' | 'allow-always' | 'deny') => {
    if (!activeExecApproval || execApprovalBusy) {
      return;
    }
    setExecApprovalBusy(true);
    setExecApprovalError(null);
    const result = await submitExecApprovalDecision({
      requestedId: activeExecApproval.id,
      decision,
      currentSessionKey,
    });
    if (!result.ok) {
      const message = result.message;
      if (/unknown or expired approval id/i.test(message)) {
        useGatewayStore.setState((state) => ({
          execApprovalQueue: state.execApprovalQueue.filter((entry) => entry.id !== activeExecApproval.id),
        }));
      }
      setExecApprovalError({
        approvalId: activeExecApproval.id,
        message,
      });
      setExecApprovalBusy(false);
      return;
    }
    if (result.syncError) {
      useChatStore.setState({ error: `Approval transcript sync failed: ${result.syncError}` });
    }
    setExecApprovalBusy(false);
  }, [activeExecApproval, currentSessionKey, execApprovalBusy]);

  return (
    <div className={cn('app-chat-shell relative flex h-full flex-col transition-colors duration-500')}>
      <div className="app-chat-main-stage relative flex min-h-0 flex-1 flex-col">
        <div
          ref={scrollRef}
          className={cn(
            'chat-im-font app-chat-workspace-shell flex-1 min-w-0 overflow-y-auto px-4 py-3 md:px-6 md:py-4',
            scrollChromeClass,
          )}
        >
          {isEmpty ? (
            <ChatEmptyState
              contentRef={contentRef}
              onQuickAction={(nextDraft) => {
                setDraftSeed(nextDraft);
                setDraftSeedVersion((version) => version + 1);
              }}
            />
          ) : (
            <div className="app-chat-content-inset app-chat-workspace-frame flex min-h-full flex-col justify-end">
              <div ref={contentRef} className="app-chat-thread-flow flex flex-col">
                {renderedMessages.map(({ message, idx, showAvatar, isClusteredWithPrevious }, visibleIndex) => (
                  <div
                    key={message.id || `msg-${idx}`}
                    className={cn(stackSpacingClass(isClusteredWithPrevious, visibleIndex === 0))}
                  >
                    <ChatMessage
                      message={message}
                      showThinking={showThinking}
                      assistantAvatar={assistantAvatar}
                      showAvatar={showAvatar}
                    />
                  </div>
                ))}

                {shouldRenderStreaming && !streamingDuplicatesLastAssistant && (
                  <div className={cn(nextAssistantSpacingClass)}>
                    <ChatMessage
                      message={(streamMsg
                        ? {
                            ...(streamMsg as Record<string, unknown>),
                            role: (typeof streamMsg.role === 'string' ? streamMsg.role : 'assistant') as RawMessage['role'],
                            content: streamMsg.content ?? streamText,
                            timestamp: streamMsg.timestamp,
                          }
                        : {
                            role: 'assistant',
                            content: streamText,
                          }) as RawMessage}
                      showThinking={showThinking}
                      assistantAvatar={assistantAvatar}
                      showAvatar={nextAssistantAvatarVisible}
                      isStreaming
                      streamingTools={streamingTools}
                    />
                  </div>
                )}

                {sending && pendingFinal && !shouldRenderStreaming && (
                  <div className={cn(nextAssistantSpacingClass)}>
                    <ActivityIndicator phase="tool_processing" avatar={assistantAvatar} showAvatar={nextAssistantAvatarVisible} />
                  </div>
                )}

                {sending && !pendingFinal && !hasAnyStreamContent && (
                  <div className={cn(nextAssistantSpacingClass)}>
                    <TypingIndicator avatar={assistantAvatar} showAvatar={nextAssistantAvatarVisible} />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {activeExecApproval ? (
          <ExecApprovalOverlay
            entry={activeExecApproval}
            queueCount={execApprovalQueue.length}
            busy={execApprovalBusy}
            error={execApprovalError?.approvalId === activeExecApproval.id ? execApprovalError.message : null}
            onDecision={handleExecApprovalDecision}
          />
        ) : null}

        {composerErrorCopy && (
          <div className="app-chat-content-inset app-chat-workspace-frame px-4 pb-2 md:px-6">
            <div className="flex justify-end">
              <div className="app-chat-composer-error" role="status" aria-live="polite">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="app-chat-composer-error-dot" aria-hidden="true" />
                  <p className="truncate text-[13px] font-medium">{composerErrorCopy}</p>
                </div>
                <button
                  type="button"
                  onClick={clearError}
                  className="app-chat-composer-error-action"
                  aria-label={t('common:actions.dismiss')}
                  title={t('common:actions.dismiss')}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {skillFlowRailCopy && (
          <div className="app-chat-content-inset app-chat-workspace-frame px-4 pb-2 md:px-6">
            <div className="flex justify-end">
              <div data-testid="chat-skill-flow-rail" className="app-chat-skill-flow-rail">
                <div className="min-w-0 flex-1">
                  <div className="app-chat-skill-flow-meta">
                    <span className="app-chat-skill-flow-badge">{skillFlowRailCopy.sourceLabel}</span>
                    <span className="truncate text-[12px] font-medium text-foreground/46">{skillFlowState?.draft.name || skillFlowState?.draft.title}</span>
                  </div>
                  <p className="truncate text-[13px] font-semibold text-foreground/86">{skillFlowRailCopy.title}</p>
                  <p className="mt-0.5 text-[12px] font-medium leading-[1.55] text-foreground/56">{skillFlowRailCopy.description}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    className="app-chat-skill-flow-return"
                    onClick={handleReturnToSkills}
                    data-testid="chat-skill-flow-return"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    <span>{t('skillFlow.returnToSkills', { defaultValue: '返回技能页' })}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSkillFlowState(null)}
                    className="app-chat-skill-flow-dismiss"
                    aria-label={t('common:actions.dismiss')}
                    title={t('common:actions.dismiss')}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <ChatInput
          onSend={sendMessage}
          onSendSkillDraft={handleSendSkillDraft}
          onStop={abortRun}
          disabled={!isGatewayRunning}
          sending={sending}
          isEmpty={isEmpty}
          draftSeed={draftSeed}
          draftSeedVersion={draftSeedVersion}
          pendingSkillDraft={pendingSkillDraft}
          showScrollToLatest={showScrollToLatest}
          hasPendingLatest={hasPendingLatest}
          onScrollToLatest={scrollToLatest}
        />

        {isHistoryLoading && !sending && (
          <div className="absolute inset-0 z-50 flex items-center justify-center rounded-xl bg-background/18 pointer-events-auto">
            <div className="rounded-md border border-border/65 bg-[hsl(var(--surface-elevated)/0.98)] p-2.5 shadow-sm">
              <LoadingSpinner size="md" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Welcome Screen ──────────────────────────────────────────────

function WelcomeScreen({
  onQuickAction,
}: {
  onQuickAction: (draft: string) => void;
}) {
  const { t } = useTranslation('chat');
  const welcomeDescription = t('welcome.description');
  const quickActions: Array<{
    key: keyof typeof welcomeCardClassNames;
    kicker: string;
    label: string;
    description: string;
    prompt: string;
    className: (typeof welcomeCardClassNames)[keyof typeof welcomeCardClassNames];
  }> = [
    {
      key: 'execution',
      kicker: t('welcome.executionKicker'),
      label: t('welcome.execution'),
      description: t('welcome.executionDesc'),
      prompt: t('welcome.executionPrompt'),
      className: welcomeCardClassNames.execution,
    },
    {
      key: 'continuation',
      kicker: t('welcome.continuationKicker'),
      label: t('welcome.continuation'),
      description: t('welcome.continuationDesc'),
      prompt: t('welcome.continuationPrompt'),
      className: welcomeCardClassNames.continuation,
    },
    {
      key: 'orchestration',
      kicker: t('welcome.orchestrationKicker'),
      label: t('welcome.orchestration'),
      description: t('welcome.orchestrationDesc'),
      prompt: t('welcome.orchestrationPrompt'),
      className: welcomeCardClassNames.orchestration,
    },
    {
      key: 'integration',
      kicker: t('welcome.integrationKicker'),
      label: t('welcome.integration'),
      description: t('welcome.integrationDesc'),
      prompt: t('welcome.integrationPrompt'),
      className: welcomeCardClassNames.integration,
    },
  ];

  return (
    <div data-testid="chat-welcome-hero" className="app-chat-welcome-hero flex min-h-full w-full flex-col px-1 pb-4 pt-1">
      <div className="app-chat-welcome-stage">
        <div className="app-chat-welcome-brand">
          <div className="app-chat-welcome-logo-shell" aria-hidden="true">
            <span className="app-chat-openclaw-stars" />
            <span className="app-chat-openclaw-nebula" />
            <OpenClawLobsterMark />
          </div>
          <div className="app-chat-welcome-copy">
            <div className="app-chat-welcome-title" data-testid="chat-welcome-wordmark" aria-hidden="true">
              <XClawWelcomeWordmark />
            </div>
            <h1 className="sr-only">{t('welcome.title')}</h1>
            <p className="app-chat-welcome-tagline">{t('welcome.subtitle')}</p>
            {welcomeDescription.trim() ? (
              <p className="app-chat-welcome-description">{welcomeDescription}</p>
            ) : null}
          </div>
        </div>

        <div className="app-chat-welcome-actions">
          {quickActions.map(({ key, kicker, label, description, prompt, className }) => (
            <button
              key={key}
              className={cn('app-chat-welcome-card group text-left', className)}
              onClick={() => onQuickAction(prompt)}
            >
              <div className="app-chat-welcome-card-copy min-w-0">
                <div className="app-chat-welcome-card-kicker">{kicker}</div>
                <div className="app-chat-welcome-card-label">{label}</div>
                <p className="app-chat-welcome-card-desc">{description}</p>
              </div>
              <WelcomeCardIllustration mode={key} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ChatEmptyState({
  contentRef,
  onQuickAction,
}: {
  contentRef: React.Ref<HTMLElement>;
  onQuickAction: (draft: string) => void;
}) {
  return (
    <div
      ref={contentRef as React.Ref<HTMLDivElement>}
      className="app-chat-content-inset app-chat-workspace-frame app-chat-empty-state-frame space-y-5"
    >
      <WelcomeScreen onQuickAction={onQuickAction} />
    </div>
  );
}

function OpenClawLobsterMark() {
  return (
    <div className="app-chat-openclaw-atmosphere">
      <div className="app-chat-openclaw-lobster-icon">
        <svg
          viewBox="0 0 120 120"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="app-chat-openclaw-lobster-svg"
        >
          <path
            d="M60 10 C30 10 15 35 15 55 C15 75 30 95 45 100 L45 110 L55 110 L55 100 C55 100 60 102 65 100 L65 110 L75 110 L75 100 C90 95 105 75 105 55 C105 35 90 10 60 10Z"
            fill="url(#app-chat-openclaw-lobster-gradient)"
            className="app-chat-openclaw-claw-body"
          />
          <path
            d="M20 45 C5 40 0 50 5 60 C10 70 20 65 25 55 C28 48 25 45 20 45Z"
            fill="url(#app-chat-openclaw-lobster-gradient)"
            className="app-chat-openclaw-claw-left"
          />
          <path
            d="M100 45 C115 40 120 50 115 60 C110 70 100 65 95 55 C92 48 95 45 100 45Z"
            fill="url(#app-chat-openclaw-lobster-gradient)"
            className="app-chat-openclaw-claw-right"
          />
          <path
            d="M45 15 Q35 5 30 8"
            stroke="#ff4d4d"
            strokeWidth="2"
            strokeLinecap="round"
            className="app-chat-openclaw-antenna"
          />
          <path
            d="M75 15 Q85 5 90 8"
            stroke="#ff4d4d"
            strokeWidth="2"
            strokeLinecap="round"
            className="app-chat-openclaw-antenna"
          />
          <circle cx="45" cy="35" r="6" fill="#050810" className="app-chat-openclaw-eye" />
          <circle cx="75" cy="35" r="6" fill="#050810" className="app-chat-openclaw-eye" />
          <circle cx="46" cy="34" r="2" fill="#00e5cc" className="app-chat-openclaw-eye-glow" />
          <circle cx="76" cy="34" r="2" fill="#00e5cc" className="app-chat-openclaw-eye-glow" />
          <defs>
            <linearGradient id="app-chat-openclaw-lobster-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ff4d4d" />
              <stop offset="100%" stopColor="#991b1b" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    </div>
  );
}

function WelcomeCardIllustration({
  mode,
}: {
  mode: 'execution' | 'continuation' | 'orchestration' | 'integration';
}) {
  if (mode === 'execution') {
    return (
      <div className="app-chat-welcome-card-art app-chat-welcome-card-art--execution" aria-hidden="true">
        <span className="app-chat-welcome-execution-tray" />
        <span className="app-chat-welcome-execution-sheet app-chat-welcome-execution-sheet--left" />
        <span className="app-chat-welcome-execution-sheet app-chat-welcome-execution-sheet--center" />
        <span className="app-chat-welcome-execution-sheet app-chat-welcome-execution-sheet--right" />
        <span className="app-chat-welcome-execution-pill app-chat-welcome-execution-pill--file" />
        <span className="app-chat-welcome-execution-pill app-chat-welcome-execution-pill--tool" />
      </div>
    );
  }

  if (mode === 'continuation') {
    return (
      <div className="app-chat-welcome-card-art app-chat-welcome-card-art--continuation" aria-hidden="true">
        <span className="app-chat-welcome-continuation-rail" />
        <span className="app-chat-welcome-continuation-panel app-chat-welcome-continuation-panel--back" />
        <span className="app-chat-welcome-continuation-panel app-chat-welcome-continuation-panel--front" />
        <span className="app-chat-welcome-continuation-dot app-chat-welcome-continuation-dot--one" />
        <span className="app-chat-welcome-continuation-dot app-chat-welcome-continuation-dot--two" />
        <span className="app-chat-welcome-continuation-dot app-chat-welcome-continuation-dot--three" />
      </div>
    );
  }

  if (mode === 'integration') {
    return (
      <div className="app-chat-welcome-card-art app-chat-welcome-card-art--integration" aria-hidden="true">
        <span className="app-chat-welcome-integration-hub" />
        <span className="app-chat-welcome-integration-port app-chat-welcome-integration-port--top" />
        <span className="app-chat-welcome-integration-port app-chat-welcome-integration-port--left" />
        <span className="app-chat-welcome-integration-port app-chat-welcome-integration-port--right" />
        <span className="app-chat-welcome-integration-link app-chat-welcome-integration-link--left" />
        <span className="app-chat-welcome-integration-link app-chat-welcome-integration-link--right" />
        <span className="app-chat-welcome-integration-link app-chat-welcome-integration-link--top" />
        <span className="app-chat-welcome-integration-module app-chat-welcome-integration-module--left" />
        <span className="app-chat-welcome-integration-module app-chat-welcome-integration-module--center" />
        <span className="app-chat-welcome-integration-module app-chat-welcome-integration-module--right" />
      </div>
    );
  }

  return (
    <div className="app-chat-welcome-card-art app-chat-welcome-card-art--orchestration" aria-hidden="true">
      <span className="app-chat-welcome-orchestration-link app-chat-welcome-orchestration-link--left" />
      <span className="app-chat-welcome-orchestration-link app-chat-welcome-orchestration-link--right" />
      <span className="app-chat-welcome-orchestration-link app-chat-welcome-orchestration-link--down" />
      <span className="app-chat-welcome-orchestration-node app-chat-welcome-orchestration-node--hub" />
      <span className="app-chat-welcome-orchestration-node app-chat-welcome-orchestration-node--left" />
      <span className="app-chat-welcome-orchestration-node app-chat-welcome-orchestration-node--right" />
      <span className="app-chat-welcome-orchestration-node app-chat-welcome-orchestration-node--down" />
      <span className="app-chat-welcome-orchestration-chip app-chat-welcome-orchestration-chip--channel" />
      <span className="app-chat-welcome-orchestration-chip app-chat-welcome-orchestration-chip--schedule" />
    </div>
  );
}

// ── Typing Indicator ────────────────────────────────────────────

function TypingIndicator({
  avatar,
  showAvatar,
}: {
  avatar: Pick<AgentSummary, 'id' | 'name' | 'avatarProfile'>;
  showAvatar: boolean;
}) {
  return (
    <div className="app-chat-typing-row chat-im-font">
      {showAvatar ? (
        <AgentAvatar agentId={avatar.id} profile={avatar.avatarProfile} size={30} className="mt-0.5" />
      ) : (
        <div aria-hidden="true" className="mt-0.5 h-[30px] w-[30px] shrink-0" />
      )}
      <div className="app-chat-typing-bubble" role="status" aria-live="polite">
        <div className="app-chat-typing-indicator" aria-hidden="true">
          <span className="typing-dot h-1.5 w-1.5 rounded-full bg-muted-foreground/50" style={{ animationDelay: '0ms' }} />
          <span className="typing-dot h-1.5 w-1.5 rounded-full bg-muted-foreground/50" style={{ animationDelay: '140ms' }} />
          <span className="typing-dot h-1.5 w-1.5 rounded-full bg-muted-foreground/50" style={{ animationDelay: '280ms' }} />
        </div>
      </div>
    </div>
  );
}

// ── Activity Indicator (shown between tool cycles) ─────────────

function ActivityIndicator({
  phase,
  avatar,
  showAvatar,
}: {
  phase: 'tool_processing';
  avatar: Pick<AgentSummary, 'id' | 'name' | 'avatarProfile'>;
  showAvatar: boolean;
}) {
  const { t } = useTranslation('chat');
  void phase;
  return (
    <div className="app-chat-typing-row chat-im-font">
      {showAvatar ? (
        <AgentAvatar agentId={avatar.id} profile={avatar.avatarProfile} size={30} className="mt-0.5" />
      ) : (
        <div aria-hidden="true" className="mt-0.5 h-[30px] w-[30px] shrink-0" />
      )}
      <div className="app-chat-typing-bubble" role="status" aria-live="polite">
        <div className="app-chat-typing-status">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
          <span>{t('message.toolProcessing')}</span>
        </div>
      </div>
    </div>
  );
}

export default Chat;
