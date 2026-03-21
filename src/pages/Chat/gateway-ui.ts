import type { GatewayStatus } from '@/types/gateway';

type GatewayUi = {
  labelKey:
    | 'composer.gatewayConnectedHint'
    | 'composer.gatewayConnectingHint'
    | 'composer.gatewayReconnectingHint'
    | 'composer.gatewayDisconnectedHint'
    | 'composer.gatewayErrorHint';
  placeholderKey:
    | 'composer.gatewayConnectingPlaceholder'
    | 'composer.gatewayDisconnectedPlaceholder'
    | null;
  toneClass:
    | 'status-indicator-connected'
    | 'status-indicator-connecting'
    | 'status-indicator-disconnected'
    | 'status-indicator-error';
  spinning: boolean;
};

export const resolveGatewayUi = (state: GatewayStatus['state']): GatewayUi => {
  switch (state) {
    case 'running':
      return {
        labelKey: 'composer.gatewayConnectedHint',
        placeholderKey: null,
        toneClass: 'status-indicator-connected',
        spinning: false,
      };
    case 'starting':
      return {
        labelKey: 'composer.gatewayConnectingHint',
        placeholderKey: 'composer.gatewayConnectingPlaceholder',
        toneClass: 'status-indicator-connecting',
        spinning: true,
      };
    case 'reconnecting':
      return {
        labelKey: 'composer.gatewayReconnectingHint',
        placeholderKey: 'composer.gatewayConnectingPlaceholder',
        toneClass: 'status-indicator-connecting',
        spinning: true,
      };
    case 'error':
      return {
        labelKey: 'composer.gatewayErrorHint',
        placeholderKey: 'composer.gatewayDisconnectedPlaceholder',
        toneClass: 'status-indicator-error',
        spinning: false,
      };
    default:
      return {
        labelKey: 'composer.gatewayDisconnectedHint',
        placeholderKey: 'composer.gatewayDisconnectedPlaceholder',
        toneClass: 'status-indicator-disconnected',
        spinning: false,
      };
  }
};
