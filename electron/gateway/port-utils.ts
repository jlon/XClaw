import { createServer } from 'node:net';

const LOCALHOST_HOSTS = ['127.0.0.1', '::1'] as const;

export async function isLocalGatewayPortAvailable(port: number): Promise<boolean> {
  for (const host of LOCALHOST_HOSTS) {
    const available = await new Promise<boolean>((resolve) => {
      const server = createServer();
      const cleanup = (): void => {
        server.removeAllListeners();
      };

      server.once('error', (error: NodeJS.ErrnoException) => {
        cleanup();
        if (host === '::1' && (error.code === 'EAFNOSUPPORT' || error.code === 'EADDRNOTAVAIL')) {
          resolve(true);
          return;
        }
        resolve(false);
      });

      server.once('listening', () => {
        server.close(() => {
          cleanup();
          resolve(true);
        });
      });

      server.listen(port, host);
    });

    if (!available) {
      return false;
    }
  }

  return true;
}

export async function findSuggestedGatewayPort(preferredPort: number, scanWindow = 10): Promise<number> {
  for (let offset = 0; offset < scanWindow; offset += 1) {
    const candidate = preferredPort + offset;
    if (await isLocalGatewayPortAvailable(candidate)) {
      return candidate;
    }
  }

  return preferredPort;
}
