import type { GatewayStatus } from '../gateway/manager';
import type { JsonRpcNotification } from '../gateway/protocol';
import { listAgentsSnapshot } from '../utils/agent-config';
import { logger } from '../utils/logger';
import { getStudioLastKnownGoodPaths, getStudioSnapshotPaths } from './paths';
import { commitStudioSnapshot, readStudioSnapshot } from './state-store';
import type { StudioAgentSnapshot, StudioCommittedSnapshot } from './types';

const DEFAULT_MAIN_AGENT: StudioAgentSnapshot = {
  agentId: 'main',
  displayName: 'Main Agent',
  status: 'idle',
  detail: '等待任务中...',
  detailSource: 'default',
  updatedAt: new Date().toISOString(),
};

const normalizeText = (value: string): string => value.replace(/\s+/g, ' ').trim().slice(0, 120);

const extractText = (value: unknown): string | null => {
  if (typeof value === 'string') {
    const normalized = normalizeText(value);
    return normalized.length > 0 ? normalized : null;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const extracted = extractText(item);
      if (extracted) {
        return extracted;
      }
    }
    return null;
  }
  if (!value || typeof value !== 'object') {
    return null;
  }
  const record = value as Record<string, unknown>;
  for (const key of ['text', 'content', 'message', 'detail', 'summary']) {
    const extracted = extractText(record[key]);
    if (extracted) {
      return extracted;
    }
  }
  return null;
};

export class StudioStateManager {
  private mainAgent: StudioAgentSnapshot = { ...DEFAULT_MAIN_AGENT };
  private agentInventory = new Map<string, StudioAgentSnapshot>();

  async bootstrap(): Promise<void> {
    const currentPaths = getStudioSnapshotPaths();
    const lastKnownGoodPaths = getStudioLastKnownGoodPaths();
    const existing = await readStudioSnapshot(currentPaths, lastKnownGoodPaths);
    if (existing) {
      this.loadSnapshot(existing);
      return;
    }
    await this.refreshAgentInventory();
    await this.flush();
  }

  getCurrentSnapshot(): { mainAgent: StudioAgentSnapshot; agents: StudioAgentSnapshot[] } {
    return {
      mainAgent: { ...this.mainAgent },
      agents: [...this.agentInventory.values()].map((agent) => ({ ...agent })),
    };
  }

  async refreshAgentInventory(): Promise<void> {
    const snapshot = await listAgentsSnapshot();
    const nextInventory = new Map<string, StudioAgentSnapshot>();
    const mainAgent = snapshot.agents.find((agent) => agent.id === 'main');
    if (mainAgent) {
      this.mainAgent = {
        ...this.mainAgent,
        agentId: mainAgent.id,
        displayName: mainAgent.name || 'Main Agent',
      };
    }
    for (const agent of snapshot.agents) {
      if (agent.id === this.mainAgent.agentId) {
        continue;
      }
      const current = this.agentInventory.get(agent.id);
      nextInventory.set(agent.id, {
        agentId: agent.id,
        displayName: agent.name || agent.id,
        status: current?.status ?? 'idle',
        detail: current?.detail ?? '等待任务中...',
        detailSource: current?.detailSource ?? 'default',
        updatedAt: current?.updatedAt ?? new Date().toISOString(),
      });
    }
    this.agentInventory = nextInventory;
    await this.flush();
  }

  async handleGatewayStatus(status: GatewayStatus): Promise<void> {
    if (status.state === 'starting' || status.state === 'reconnecting') {
      this.updateMainAgent('syncing', '正在同步工作室运行时...', 'event-summary');
    } else if (status.state === 'running') {
      this.updateMainAgent('idle', this.mainAgent.detail || '等待任务中...', this.mainAgent.detailSource);
    } else if (status.state === 'failed' || status.state === 'error') {
      this.updateMainAgent('error', status.error || '运行时异常', 'event-summary');
    } else if (status.state === 'stopped') {
      this.updateMainAgent('idle', '等待任务中...', 'default');
    }
    await this.flush();
  }

  async handleGatewayNotification(notification: JsonRpcNotification): Promise<void> {
    const method = notification.method || '';
    if (method.includes('tool')) {
      this.updateMainAgent('executing', extractText(notification.params) || '正在执行工具...', 'event-summary');
    } else if (method.includes('agent')) {
      this.updateMainAgent('syncing', extractText(notification.params) || '正在同步智能体状态...', 'event-summary');
    }
    await this.flush();
  }

  async handleChatMessage(message: unknown): Promise<void> {
    const detail = extractText(message) || '正在处理聊天消息...';
    this.updateMainAgent('writing', detail, 'event-summary');
    await this.flush();
  }

  private updateMainAgent(
    status: StudioAgentSnapshot['status'],
    detail: string,
    detailSource: StudioAgentSnapshot['detailSource'],
  ): void {
    this.mainAgent = {
      ...this.mainAgent,
      status,
      detail,
      detailSource,
      updatedAt: new Date().toISOString(),
    };
  }

  private loadSnapshot(snapshot: StudioCommittedSnapshot): void {
    this.mainAgent = { ...snapshot.main.agent };
    this.agentInventory = new Map(
      snapshot.agents.agents.map((agent) => [agent.agentId, { ...agent }]),
    );
  }

  private async flush(): Promise<void> {
    try {
      await commitStudioSnapshot({
        currentPaths: getStudioSnapshotPaths(),
        lastKnownGoodPaths: getStudioLastKnownGoodPaths(),
        mainAgent: this.mainAgent,
        agents: [...this.agentInventory.values()],
      });
    } catch (error) {
      logger.warn('Failed to flush Studio snapshot', error);
    }
  }
}
