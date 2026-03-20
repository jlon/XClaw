const AVATAR_STYLES = [
  'from-sky-500 to-indigo-500',
  'from-rose-500 to-orange-500',
  'from-emerald-500 to-lime-500',
  'from-fuchsia-500 to-pink-500',
  'from-amber-500 to-red-500',
  'from-cyan-500 to-blue-500',
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
