const AVATAR_STYLES = [
  'chat-avatar-tone-1',
  'chat-avatar-tone-2',
  'chat-avatar-tone-3',
  'chat-avatar-tone-4',
  'chat-avatar-tone-5',
  'chat-avatar-tone-6',
];

const getAvatarIndex = (value: string) =>
  Array.from(value).reduce((sum, char) => sum + char.charCodeAt(0), 0) % AVATAR_STYLES.length;

const getAvatarGlyph = (value: string, fallback = 'A') =>
  Array.from(value.trim())[0]?.toUpperCase() ?? fallback;

export const getAgentIdFromSessionKey = (sessionKey: string) => {
  if (!sessionKey.startsWith('agent:')) return 'main';
  const [, agentId] = sessionKey.split(':');
  return agentId || 'main';
};

export const getAvatarLabel = (value: string, fallback?: string) =>
  getAvatarGlyph(value, fallback);

export const getSessionAvatar = ({
  sessionKey,
  agentId,
  agentName,
}: {
  sessionKey: string;
  agentId?: string;
  agentName: string;
}) => {
  const resolvedAgentId = agentId || getAgentIdFromSessionKey(sessionKey);
  return {
    label: getAvatarGlyph(agentName, getAvatarGlyph(resolvedAgentId)),
    style: AVATAR_STYLES[getAvatarIndex(`${resolvedAgentId}:${sessionKey}`)],
  };
};
