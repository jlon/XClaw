import type { BrowserWindow } from 'electron';
import type { GatewayManager } from '../gateway/manager';
import type { GatewayRuntimeController } from '../gateway/runtime-controller';
import type { ClawHubService } from '../gateway/clawhub';
import type { HostEventBus } from './event-bus';
import type { StudioService } from '../studio/service';

export interface HostApiContext {
  gatewayManager: GatewayManager;
  gatewayRuntimeController: GatewayRuntimeController;
  clawHubService: ClawHubService;
  studioService: StudioService;
  eventBus: HostEventBus;
  mainWindow: BrowserWindow | null;
}
