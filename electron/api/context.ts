import type { BrowserWindow } from 'electron';
import type { GatewayManager } from '../gateway/manager';
import type { GatewayRuntimeController } from '../gateway/runtime-controller';
import type { ClawHubService } from '../gateway/clawhub';
import type { HostEventBus } from './event-bus';

export interface HostApiContext {
  gatewayManager: GatewayManager;
  gatewayRuntimeController: GatewayRuntimeController;
  clawHubService: ClawHubService;
  eventBus: HostEventBus;
  mainWindow: BrowserWindow | null;
}
