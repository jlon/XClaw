import { mkdirSync } from 'fs';

type UserDataOverrideOptions = {
  env?: NodeJS.ProcessEnv;
  ensureDir?: (path: string) => void;
  app: {
    setPath: (name: string, value: string) => void;
  };
  logger?: {
    info: (message: string) => void;
    warn: (message: string) => void;
  };
};

export function applyUserDataDirOverride(options: UserDataOverrideOptions): string | null {
  const env = options.env ?? process.env;
  const overridePath = env.XClaw_USER_DATA_DIR?.trim();

  if (!overridePath) {
    return null;
  }

  try {
    (options.ensureDir ?? ((path) => mkdirSync(path, { recursive: true })))(overridePath);
    options.app.setPath('userData', overridePath);
    options.logger?.info(`Overriding userData directory: ${overridePath}`);
    return overridePath;
  } catch (error) {
    options.logger?.warn(`Failed to override userData directory: ${String(error)}`);
    return null;
  }
}
