import { EventEmitter } from 'events';
import type { GatewayManager } from '../gateway/manager';
import type { JsonRpcNotification } from '../gateway/protocol';
import { StudioRuntimeManager } from './runtime-manager';
import { StudioStateManager } from './state-manager';
import type { StudioRuntimeSnapshot } from './types';

export class StudioService extends EventEmitter {
  private readonly runtimeManager = new StudioRuntimeManager();
  private readonly stateManager = new StudioStateManager();
  private initialized = false;

  constructor(private readonly gatewayManager: GatewayManager) {
    super();
    this.runtimeManager.on('snapshot', (snapshot: StudioRuntimeSnapshot) => {
      this.emit('runtime-snapshot', snapshot);
    });
  }

  private ensureBound(): void {
    if (this.initialized) {
      return;
    }
    this.initialized = true;
    this.gatewayManager.on('status', (status) => {
      void this.stateManager.handleGatewayStatus(status);
    });
    this.gatewayManager.on('notification', (notification: JsonRpcNotification) => {
      void this.stateManager.handleGatewayNotification(notification);
    });
    this.gatewayManager.on('chat:message', (payload: { message: unknown }) => {
      void this.stateManager.handleChatMessage(payload.message);
    });
  }

  async start(): Promise<StudioRuntimeSnapshot> {
    this.ensureBound();
    await this.stateManager.bootstrap();
    await this.stateManager.refreshAgentInventory();
    return await this.runtimeManager.start();
  }

  async retryRuntime(options: { repairEnvironment?: boolean } = {}): Promise<StudioRuntimeSnapshot> {
    this.ensureBound();
    return await this.runtimeManager.retry(options);
  }

  getRuntimeSnapshot(): StudioRuntimeSnapshot {
    return this.runtimeManager.getSnapshot();
  }

  async refreshAgentInventory(): Promise<void> {
    this.ensureBound();
    await this.stateManager.refreshAgentInventory();
  }

  async stop(): Promise<void> {
    await this.runtimeManager.stop();
  }
}
