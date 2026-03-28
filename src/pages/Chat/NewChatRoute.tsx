import { useEffect, useRef } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useChatStore } from '@/stores/chat';

export function NewChatRoute() {
  const location = useLocation();
  const navigate = useNavigate();
  const { agentId } = useParams<{ agentId?: string }>();
  const currentAgentId = useChatStore((s) => s.currentAgentId);
  const newSession = useChatStore((s) => s.newSession);
  const handledCommandRef = useRef<string | null>(null);

  useEffect(() => {
    const nextCommandId = `${location.key}:${agentId ?? currentAgentId}`;
    if (handledCommandRef.current === nextCommandId) {
      return;
    }
    handledCommandRef.current = nextCommandId;
    newSession(agentId ?? currentAgentId);
    navigate('/', { replace: true, state: location.state });
  }, [agentId, currentAgentId, location.key, location.state, navigate, newSession]);

  return null;
}
