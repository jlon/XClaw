import type { ChildProcess } from 'node:child_process';

export type ManagedGatewayProcess = Electron.UtilityProcess | ChildProcess;
