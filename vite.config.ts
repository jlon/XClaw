import process from 'node:process';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';
import { resolve } from 'path';
import {
  getElectronDevBackendMessage,
  getElectronDevRuntime,
  getElectronDevSkipMessage,
  shouldReloadElectronDev,
} from './scripts/dev-runtime.mjs';

const electronDevRuntime = getElectronDevRuntime();
let hasWarnedElectronDevSkip = false;
let hasWarnedElectronDevBackend = false;

const warnElectronDevSkip = () => {
  if (hasWarnedElectronDevSkip) {
    return;
  }

  hasWarnedElectronDevSkip = true;
  console.warn(getElectronDevSkipMessage());
};

const warnElectronDevBackend = () => {
  if (hasWarnedElectronDevBackend) {
    return;
  }

  hasWarnedElectronDevBackend = true;
  console.warn(getElectronDevBackendMessage());
};

const hasElectronApp = () => Boolean(Reflect.get(process, 'electronApp'));

// https://vitejs.dev/config/
export default defineConfig({
  // Required for Electron: all asset URLs must be relative because the renderer
  // loads via file:// in production. vite-plugin-electron-renderer sets this
  // automatically, but we declare it explicitly so the intent is clear and the
  // build remains correct even if plugin order ever changes.
  base: './',
  plugins: [
    react(),
    electron([
      {
        // Main process entry file
        entry: 'electron/main/index.ts',
        onstart(options) {
          if (electronDevRuntime.mode === 'backend') {
            process.env.XCLAW_HEADLESS_DEV_BACKEND = '1';
            warnElectronDevBackend();
            options.startup();
            return;
          }

          delete process.env.XCLAW_HEADLESS_DEV_BACKEND;
          options.startup();
        },
        vite: {
          build: {
            outDir: 'dist-electron/main',
            rollupOptions: {
              external: ['electron-store', 'electron-updater', 'ws'],
            },
          },
        },
      },
      {
        // Preload scripts entry file
        entry: 'electron/preload/index.ts',
        onstart(options) {
          if (!shouldReloadElectronDev({ ...electronDevRuntime, hasElectronApp: hasElectronApp() })) {
            if (electronDevRuntime.mode === 'backend') {
              warnElectronDevBackend();
            } else {
              warnElectronDevSkip();
            }
            return;
          }

          options.reload();
        },
        vite: {
          build: {
            outDir: 'dist-electron/preload',
            rollupOptions: {
              external: ['electron'],
            },
          },
        },
      },
    ]),
    renderer(),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@electron': resolve(__dirname, 'electron'),
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3210',
        changeOrigin: false,
      },
    },
  },
  preview: {
    host: '127.0.0.1',
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3210',
        changeOrigin: false,
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        app: resolve(__dirname, 'index.html'),
        website: resolve(__dirname, 'website/index.html'),
      },
    },
  },
});
