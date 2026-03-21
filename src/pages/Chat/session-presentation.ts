export interface ChatSessionPresentation {
  title: string;
  sessionId: string | null;
}

export const deriveChatSessionPresentation = (label: string): ChatSessionPresentation => {
  const normalized = label.trim();
  if (!normalized) {
    return {
      title: '',
      sessionId: null,
    };
  }

  const match = normalized.match(/^(.*?)(?:\s+id:([^\s]+))$/i);
  if (!match) {
    return {
      title: normalized,
      sessionId: null,
    };
  }

  const nextTitle = match[1]?.trim() || normalized;
  const nextSessionId = match[2]?.trim() || null;
  return {
    title: nextTitle,
    sessionId: nextSessionId,
  };
};
