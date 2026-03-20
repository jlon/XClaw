/**
 * Async mutex for serializing read-modify-write operations on
 * ~/.openclaw/openclaw.json.
 *
 * Multiple code paths (channel-config, openclaw-auth, openclaw-proxy,
 * skill-config, agent-config) perform async read → modify → write against
 * the same JSON file.  Without coordination, Node's event-loop can
 * interleave two I/O sequences so that the second writer reads stale data
 * and overwrites the first writer's changes (classic TOCTOU race).
 *
 * The mutex is **reentrant**: if a function already holding the lock calls
 * another function that also calls `withConfigLock`, the inner call will
 * pass through without blocking.  This prevents deadlocks when e.g.
 * `deleteAgentConfig` (locked) calls `deleteAgentChannelAccounts` (also locked).
 *
 * Usage:
 *   import { withConfigLock } from './config-mutex';
 *
 *   await withConfigLock(async () => {
 *       const cfg = await readConfig();
 *       cfg.foo = 'bar';
 *       await writeConfig(cfg);
 *   });
 */

import { AsyncLocalStorage } from 'async_hooks';

/** Tracks whether the current async context already holds the config lock. */
const lockContext = new AsyncLocalStorage<boolean>();

class ConfigMutex {
    private queue: Array<() => void> = [];
    private locked = false;

    async acquire(): Promise<() => void> {
        if (!this.locked) {
            this.locked = true;
            return this.createRelease();
        }
        return new Promise<() => void>((resolve) => {
            this.queue.push(() => resolve(this.createRelease()));
        });
    }

    private createRelease(): () => void {
        let released = false;
        return () => {
            if (released) return;
            released = true;
            const next = this.queue.shift();
            if (next) {
                next();
            } else {
                this.locked = false;
            }
        };
    }
}

/** Singleton mutex shared across all openclaw.json writers. */
const configMutex = new ConfigMutex();

/**
 * Execute `fn` while holding the config mutex.
 * Ensures only one read-modify-write cycle on openclaw.json runs at a time.
 *
 * **Reentrant**: if the current async context already holds the lock
 * (i.e. an outer `withConfigLock` is on the call stack), `fn` runs
 * immediately without re-acquiring the lock.
 */
export async function withConfigLock<T>(fn: () => Promise<T>): Promise<T> {
    // If we're already inside a withConfigLock call, skip re-acquiring
    if (lockContext.getStore()) {
        return fn();
    }

    const release = await configMutex.acquire();
    try {
        return await lockContext.run(true, fn);
    } finally {
        release();
    }
}
