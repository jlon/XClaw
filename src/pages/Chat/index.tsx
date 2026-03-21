/**
 * Chat Page
 * Native React implementation communicating with OpenClaw Gateway
 * via gateway:rpc IPC. Session selector, thinking toggle, and refresh
 * are in the toolbar; messages render with markdown + streaming.
 */
import { useEffect, useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
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
  const minLoading = useMinLoading(loading && messages.length > 0);
  const { contentRef, scrollRef } = useStickToBottomInstant(currentSessionKey);

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

  const isEmpty = messages.length === 0 && !sending;

  return (
    <div className={cn('app-chat-shell relative flex h-full flex-col transition-colors duration-500')}>
      <div ref={scrollRef} className="chat-im-font flex-1 overflow-y-auto px-6 py-3">
        {isEmpty ? (
          <div ref={contentRef} className="mx-auto max-w-[1100px] space-y-4">
            <WelcomeScreen
              currentAgentName={currentAgentName}
              gatewayState={gatewayStatus.state}
            />
          </div>
        ) : (
          <div className="mx-auto max-w-[1120px]">
            <div className="app-chat-thread-stage px-5 py-5 md:px-7 md:py-6">
              <div ref={contentRef} className="space-y-4 pl-8">
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

      {/* Error bar */}
      {error && (
        <div className="px-4 py-2 bg-destructive/10 border-t border-destructive/20">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <p className="text-sm text-destructive flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              {error}
            </p>
            <button
              onClick={clearError}
              className="text-xs text-destructive/60 hover:text-destructive underline"
            >
              {t('common:actions.dismiss')}
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
    <div data-testid="chat-welcome-hero" className="app-chat-welcome-hero mx-auto flex min-h-full w-full max-w-[1080px] flex-col px-2 pb-6 pt-2">
      <div className="flex flex-1 flex-col justify-center gap-10">
        <div className="mx-auto max-w-3xl text-center">
          <p className="app-chat-header-meta text-sm">{currentAgentName}</p>
          <h1 className="mt-4 text-[3rem] font-semibold tracking-[-0.07em] text-foreground md:text-[4.25rem]">
            {t('welcome.subtitle')}
          </h1>
          <p className="mt-4 max-w-2xl text-[15px] leading-8 text-muted-foreground md:mx-auto md:text-[16px]">
            {t('welcome.description')}
          </p>
          {runtimeIssue && (
            <p className="app-chat-header-meta mt-4 text-sm">
              {runtimeIssue}
            </p>
          )}
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {quickActions.map(({ key, label, description }) => (
            <button
              key={key}
              className="app-chat-quick-action group rounded-[1.5rem] p-5 text-left transition-transform duration-200 hover:-translate-y-0.5"
            >
              <div className="text-[1rem] font-semibold tracking-[-0.03em] text-foreground">{label}</div>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">{description}</p>
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
      <div className="app-chat-bubble-assistant rounded-[18px] rounded-tl-[6px] border px-4 py-2.5 text-foreground">
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
      <div className="app-chat-bubble-assistant rounded-[18px] rounded-tl-[6px] border px-4 py-2.5 text-foreground">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
          <span>{t('message.toolProcessing')}</span>
        </div>
      </div>
    </div>
  );
}

export default Chat;
