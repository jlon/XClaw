type BeforeQuitEvent = {
  preventDefault: () => void;
};

type BeforeQuitHandlerOptions = {
  app: {
    exit: (exitCode?: number) => void;
  };
  setQuitting: () => void;
  closeAll: () => void;
  closeHostApiServer: () => void;
  handoffGateway: () => Promise<void>;
  logger: {
    warn: (message: string, ...args: unknown[]) => void;
  };
  quitTimeoutMs?: number;
};

const DEFAULT_QUIT_TIMEOUT_MS = 4000;

async function waitForQuitHandoff(
  handoffGateway: () => Promise<void>,
  quitTimeoutMs: number,
): Promise<void> {
  await Promise.race([
    handoffGateway(),
    new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Gateway quit handoff timed out after ${quitTimeoutMs}ms`));
      }, quitTimeoutMs);
    }),
  ]);
}

export function createBeforeQuitHandler(options: BeforeQuitHandlerOptions): (event: BeforeQuitEvent) => void {
  let finalizingExit = false;
  let handoffInFlight: Promise<void> | null = null;
  const quitTimeoutMs = options.quitTimeoutMs ?? DEFAULT_QUIT_TIMEOUT_MS;

  return (event) => {
    if (finalizingExit) {
      return;
    }

    event.preventDefault();
    options.setQuitting();
    options.closeAll();
    options.closeHostApiServer();

    if (handoffInFlight) {
      return;
    }

    handoffInFlight = waitForQuitHandoff(options.handoffGateway, quitTimeoutMs)
      .catch((error) => {
        options.logger.warn('Gateway quit handoff failed; forcing app exit:', error);
      })
      .finally(() => {
        finalizingExit = true;
        options.app.exit(0);
      });
  };
}
