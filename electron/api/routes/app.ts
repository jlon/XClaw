import type { IncomingMessage, ServerResponse } from 'http';
import type { HostApiContext } from '../context';
import { parseJsonBody } from '../route-utils';
import { setCorsHeaders, sendJson, sendNoContent } from '../route-utils';
import { runOpenClawDoctor, runOpenClawDoctorFix } from '../../utils/openclaw-doctor';
import { buildSetupPlan, inspectLocalOpenClawSetup } from '../../main/setup-inspection';
import {
  cancelSetupEnvironmentTask,
  getSetupEnvironmentTaskSnapshot,
  resolveSetupEnvironmentStatus,
  startSetupEnvironmentTask,
} from '../../main/setup-environment-service';
import { getTakeoverImportStatus, resetTakeoverImportStatus, runTakeoverImport } from '../../main/takeover-import';
import { runSetupActivationSideEffects } from '../../main/setup-activation';
import { getAllSettings, getSetting, replaceAllSettings, setSetting } from '../../utils/store';
import { getOpenClawStatus, primeOpenClawRootMode, setOpenClawRootMode } from '../../utils/paths';

const hasTakeoverFingerprint = async (): Promise<boolean> => {
  const fingerprint = await getSetting('takeoverFingerprint');
  return typeof fingerprint === 'string' && fingerprint.trim().length > 0;
};

export async function handleAppRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  ctx: HostApiContext,
): Promise<boolean> {
  if (url.pathname === '/api/events' && req.method === 'GET') {
    setCorsHeaders(res);
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    });
    res.write(': connected\n\n');
    ctx.eventBus.addSseClient(res);
    // Send a current-state snapshot immediately so renderer subscribers do not
    // miss lifecycle transitions that happened before the SSE connection opened.
    res.write(`event: gateway:status\ndata: ${JSON.stringify(ctx.gatewayManager.getStatus())}\n\n`);
    return true;
  }

  if (url.pathname === '/api/app/openclaw-doctor' && req.method === 'POST') {
    const body = await parseJsonBody<{ mode?: 'diagnose' | 'fix' }>(req);
    const mode = body.mode === 'fix' ? 'fix' : 'diagnose';
    sendJson(res, 200, mode === 'fix' ? await runOpenClawDoctorFix() : await runOpenClawDoctor());
    return true;
  }

  if (url.pathname === '/api/app/openclaw-status' && req.method === 'GET') {
    sendJson(res, 200, getOpenClawStatus());
    return true;
  }

  if (url.pathname === '/api/app/setup-inspection' && req.method === 'GET') {
    sendJson(res, 200, await inspectLocalOpenClawSetup());
    return true;
  }

  if (url.pathname === '/api/app/setup-plan' && req.method === 'POST') {
    const body = await parseJsonBody<{
      mode?: 'fresh' | 'takeover';
      gatewayPort?: number;
      workspacePath?: string;
    }>(req);
    const inspection = await inspectLocalOpenClawSetup({
      requestedGatewayPort: body.gatewayPort,
      requestedWorkspacePath: body.workspacePath,
    });
    sendJson(res, 200, buildSetupPlan(inspection, body));
    return true;
  }

  if (url.pathname === '/api/app/setup-environment-status' && req.method === 'GET') {
    sendJson(res, 200, await resolveSetupEnvironmentStatus());
    return true;
  }

  if (url.pathname === '/api/app/setup-environment-task' && req.method === 'GET') {
    sendJson(res, 200, getSetupEnvironmentTaskSnapshot());
    return true;
  }

  if (url.pathname === '/api/app/setup-environment-prepare' && req.method === 'POST') {
    sendJson(res, 200, await startSetupEnvironmentTask());
    return true;
  }

  if (url.pathname === '/api/app/setup-environment-cancel' && req.method === 'POST') {
    sendJson(res, 200, await cancelSetupEnvironmentTask());
    return true;
  }

  if (url.pathname === '/api/app/setup-root-mode' && req.method === 'POST') {
    const body = await parseJsonBody<{ mode?: 'fresh' | 'takeover' | null }>(req);
    const mode = body.mode;
    if (mode === 'fresh' || mode === 'takeover') {
      setOpenClawRootMode(mode);
      sendJson(res, 200, { success: true, mode });
      return true;
    }
    sendJson(res, 200, { success: true, mode: primeOpenClawRootMode() });
    return true;
  }

  if (url.pathname === '/api/app/takeover-import' && req.method === 'POST') {
    const body = await parseJsonBody<{ mode?: 'fresh' | 'takeover' }>(req);
    if (body.mode && body.mode !== 'takeover') {
      throw new Error('接管导入只支持 takeover 模式');
    }
    sendJson(res, 200, await runTakeoverImport(body));
    return true;
  }

  if (url.pathname === '/api/app/takeover-status' && req.method === 'GET') {
    sendJson(res, 200, getTakeoverImportStatus());
    return true;
  }

  if (url.pathname === '/api/app/setup-activation' && req.method === 'POST') {
    const body = await parseJsonBody<{
      mode?: 'fresh' | 'takeover';
      gatewayPort?: number;
      workspacePath?: string;
    }>(req);
    const inspection = await inspectLocalOpenClawSetup({
      requestedGatewayPort: body.gatewayPort,
      requestedWorkspacePath: body.workspacePath,
    });
    const plan = buildSetupPlan(inspection, body);
    if (!plan.canApply) {
      throw new Error(plan.blockingIssues[0] ?? '当前设置无法继续');
    }
    if (plan.mode === 'takeover') {
      const takeoverStatus = getTakeoverImportStatus();
      if (takeoverStatus.state !== 'complete' && !(await hasTakeoverFingerprint())) {
        throw new Error('接管导入尚未完成，不能提前完成安装');
      }
    }
    await runSetupActivationSideEffects({
      gatewayManager: ctx.gatewayManager,
      runtimeController: ctx.gatewayRuntimeController,
      mainWindow: ctx.mainWindow,
      awaitCriticalTasks: true,
      setup: plan.mode === 'fresh'
        ? {
          mode: 'fresh',
          gatewayPort: body.gatewayPort,
          workspacePath: body.workspacePath,
        }
        : {
          mode: 'takeover',
        },
    });
    if (plan.mode === 'fresh') {
      const settings = await getAllSettings();
      delete settings.takeoverFingerprint;
      await replaceAllSettings(settings);
      resetTakeoverImportStatus();
    }
    await ctx.studioService.start();
    await setSetting('setupComplete', true);
    sendJson(res, 200, { success: true });
    return true;
  }

  if (req.method === 'OPTIONS') {
    sendNoContent(res);
    return true;
  }

  return false;
}
