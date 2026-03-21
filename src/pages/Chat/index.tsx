/**
 * Chat Page
 * Native React implementation communicating with OpenClaw Gateway
 * via gateway:rpc IPC. Session selector, thinking toggle, and refresh
 * are in the toolbar; messages render with markdown + streaming.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, Loader2, X } from 'lucide-react';
import { AgentAvatar } from '@/components/chat/AgentAvatar';
import { useChatStore, type RawMessage } from '@/stores/chat';
import { useGatewayStore } from '@/stores/gateway';
import { useAgentsStore } from '@/stores/agents';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { extractImages, extractText, extractThinking, extractToolUse } from './message-utils';
import { useTranslation } from 'react-i18next';
import { getSessionAvatar } from '@/lib/chat-avatar';
import { cn } from '@/lib/utils';
import { useStickToBottomInstant } from '@/hooks/use-stick-to-bottom-instant';
import { useMinLoading } from '@/hooks/use-min-loading';

export function Chat() {
  const { t } = useTranslation('chat');
  const gatewayStatus = useGatewayStore((s) => s.status);
  const isGatewayRunning = gatewayStatus.state === 'running';

  const messages = useChatStore((s) => s.messages);
  const currentSessionKey = useChatStore((s) => s.currentSessionKey);
  const currentAgentId = useChatStore((s) => s.currentAgentId);
  const sessions = useChatStore((s) => s.sessions);
  const sessionLabels = useChatStore((s) => s.sessionLabels);
  const loading = useChatStore((s) => s.loading);
  const sending = useChatStore((s) => s.sending);
  const error = useChatStore((s) => s.error);
  const showThinking = useChatStore((s) => s.showThinking);
  const streamingMessage = useChatStore((s) => s.streamingMessage);
  const streamingTools = useChatStore((s) => s.streamingTools);
  const pendingFinal = useChatStore((s) => s.pendingFinal);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const abortRun = useChatStore((s) => s.abortRun);
  const clearError = useChatStore((s) => s.clearError);
  const agents = useAgentsStore((s) => s.agents);
  const fetchAgents = useAgentsStore((s) => s.fetchAgents);

  const cleanupEmptySession = useChatStore((s) => s.cleanupEmptySession);

  const [streamingTimestamp, setStreamingTimestamp] = useState<number>(0);
  const [showScrollToLatest, setShowScrollToLatest] = useState(false);
  const [hasPendingLatest, setHasPendingLatest] = useState(false);
  const minLoading = useMinLoading(loading && messages.length > 0);
  const { contentRef, scrollRef } = useStickToBottomInstant(currentSessionKey);
  const isNearBottomRef = useRef(true);

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
    void fetchAgents();
  }, [fetchAgents]);

  // Update timestamp when sending starts
  useEffect(() => {
    if (sending && streamingTimestamp === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStreamingTimestamp(Date.now() / 1000);
    } else if (!sending && streamingTimestamp !== 0) {
      setStreamingTimestamp(0);
    }
  }, [sending, streamingTimestamp]);

  // Gateway not running block has been completely removed so the UI always renders.

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
  const currentAgentName = agents.find((agent) => agent.id === currentAgentId)?.name || currentAgentId;
  const currentSessionLabel = sessionLabels[currentSessionKey] ?? activeSession?.label ?? activeSession?.displayName ?? currentAgentName;
  const assistantAvatar = getSessionAvatar({
    sessionKey: currentSessionKey || currentSessionLabel,
    agentId: currentAgentId,
    agentName: currentAgentName,
  });
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

  const isEmpty = messages.length === 0 && !sending;

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
    if (typeof scrollElement.scrollTo === 'function') {
      scrollElement.scrollTo({ top: scrollElement.scrollHeight, behavior: 'smooth' });
    } else {
      scrollElement.scrollTop = scrollElement.scrollHeight;
    }
    setHasPendingLatest(false);
  }, [scrollRef]);

  return (
    <div className={cn('app-chat-shell relative flex h-full flex-col transition-colors duration-500')}>
      <div ref={scrollRef} className="chat-im-font flex-1 overflow-y-auto px-5 py-3 md:px-6 md:py-4">
        {isEmpty ? (
          <div ref={contentRef} className="app-chat-workbench space-y-5">
            <WelcomeScreen
              currentAgentName={currentAgentName}
              gatewayState={gatewayStatus.state}
            />
          </div>
        ) : (
          <div className="app-chat-workbench">
            <div className="app-chat-thread-stage px-1 py-4 md:px-2 md:py-5">
              <div ref={contentRef} className="space-y-5">
                {messages.map((msg, idx) => (
                  <ChatMessage
                    key={msg.id || `msg-${idx}`}
                    message={msg}
                    showThinking={showThinking}
                    assistantAvatar={assistantAvatar}
                  />
                ))}

                {shouldRenderStreaming && (
                  <ChatMessage
                    message={(streamMsg
                      ? {
                          ...(streamMsg as Record<string, unknown>),
                          role: (typeof streamMsg.role === 'string' ? streamMsg.role : 'assistant') as RawMessage['role'],
                          content: streamMsg.content ?? streamText,
                          timestamp: streamMsg.timestamp ?? streamingTimestamp,
                        }
                      : {
                          role: 'assistant',
                          content: streamText,
                          timestamp: streamingTimestamp,
                        }) as RawMessage}
                    showThinking={showThinking}
                    assistantAvatar={assistantAvatar}
                    isStreaming
                    streamingTools={streamingTools}
                  />
                )}

                {sending && pendingFinal && !shouldRenderStreaming && (
                  <ActivityIndicator phase="tool_processing" avatar={assistantAvatar} />
                )}

                {sending && !pendingFinal && !hasAnyStreamContent && (
                  <TypingIndicator avatar={assistantAvatar} />
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {composerErrorCopy && (
        <div className="app-chat-workbench px-4 pb-2">
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

      {showScrollToLatest && (
        <div className="app-chat-workbench flex justify-end px-4 pb-2">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={scrollToLatest}
              className="app-chat-scroll-to-latest"
              aria-label={t('toolbar.scrollToLatest')}
              title={t('toolbar.scrollToLatest')}
            >
              <ChevronDown className="h-4 w-4" />
              {hasPendingLatest && (
                <span className="status-indicator status-indicator-glow absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[hsl(var(--primary))]" />
              )}
            </button>
          </div>
        </div>
      )}

      {/* Input Area */}
      <ChatInput
        onSend={sendMessage}
        onStop={abortRun}
        disabled={!isGatewayRunning}
        sending={sending}
        isEmpty={isEmpty}
      />

      {/* Transparent loading overlay */}
      {minLoading && !sending && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/20 backdrop-blur-[1px] rounded-xl pointer-events-auto">
          <div className="rounded-full border border-border/70 bg-card/92 p-2.5 shadow-lg">
            <LoadingSpinner size="md" />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Welcome Screen ──────────────────────────────────────────────

function WelcomeScreen({
  currentAgentName,
  gatewayState,
}: {
  currentAgentName: string;
  gatewayState: string;
}) {
  const { t } = useTranslation('chat');
  const quickActions = [
    {
      key: 'askQuestions',
      label: t('welcome.askQuestions'),
      description: t('welcome.askQuestionsDesc'),
    },
    {
      key: 'creativeTasks',
      label: t('welcome.creativeTasks'),
      description: t('welcome.creativeTasksDesc'),
    },
    {
      key: 'brainstorming',
      label: t('welcome.brainstorming'),
      description: t('welcome.brainstormingDesc'),
    },
  ];
  const runtimeIssue = gatewayState !== 'running' ? t('header.runtimeIssue', { state: gatewayState }) : null;

  return (
    <div data-testid="chat-welcome-hero" className="app-chat-welcome-hero mx-auto flex min-h-full w-full max-w-[1000px] flex-col px-1 pb-5 pt-1">
      <div className="mx-auto flex flex-1 w-full max-w-3xl flex-col justify-center gap-8">
        <div className="max-w-2xl">
          <p className="app-chat-header-meta text-[12px]">{currentAgentName}</p>
          <h1 className="mt-3 text-[2.4rem] font-semibold tracking-[-0.06em] text-foreground md:text-[3.2rem]">
            {t('welcome.subtitle')}
          </h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-7 text-muted-foreground md:text-[16px]">
            {t('welcome.description')}
          </p>
          {runtimeIssue && (
            <p className="app-chat-header-meta mt-4 text-sm">
              {runtimeIssue}
            </p>
          )}
        </div>

        <div className="space-y-2.5">
          {quickActions.map(({ key, label, description }) => (
            <button
              key={key}
              className="app-chat-quick-action group px-1 py-3 text-left"
            >
              <div className="app-chat-quick-action-copy min-w-0">
                <div className="app-chat-quick-action-label">{label}</div>
                <p className="app-chat-quick-action-desc">{description}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Typing Indicator ────────────────────────────────────────────

function TypingIndicator({
  avatar,
}: {
  avatar: {
    label: string;
    style: string;
  };
}) {
  return (
    <div className="chat-im-font flex gap-2.5">
      <AgentAvatar label={avatar.label} style={avatar.style} className="mt-1 h-9 w-9" textClassName="text-sm" />
      <div className="app-chat-runtime-pill w-fit rounded-[14px] px-3 py-2 text-foreground">
        <div className="flex gap-1">
          <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
}

// ── Activity Indicator (shown between tool cycles) ─────────────

function ActivityIndicator({
  phase,
  avatar,
}: {
  phase: 'tool_processing';
  avatar: {
    label: string;
    style: string;
  };
}) {
  const { t } = useTranslation('chat');
  void phase;
  return (
    <div className="chat-im-font flex gap-2.5">
      <AgentAvatar label={avatar.label} style={avatar.style} className="mt-1 h-9 w-9" textClassName="text-sm" />
      <div className="app-chat-runtime-pill w-fit rounded-[14px] px-3 py-2 text-foreground">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
          <span>{t('message.toolProcessing')}</span>
        </div>
      </div>
    </div>
  );
}

export default Chat;
