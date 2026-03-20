# AGENTS.md

## Cursor Cloud specific instructions

### Overview

ClawX is a cross-platform **Electron desktop app** (React 19 + Vite + TypeScript) providing a GUI for the OpenClaw AI agent runtime. It uses pnpm as its package manager (pinned version in `package.json`'s `packageManager` field).

### Quick reference

Standard dev commands are in `package.json` scripts and `README.md`. Key ones:

| Task | Command |
|------|---------|
| Install deps + download uv | `pnpm run init` |
| Dev server (Vite + Electron) | `pnpm dev` |
| Lint (ESLint, auto-fix) | `pnpm run lint` |
| Type check | `pnpm run typecheck` |
| Unit tests (Vitest) | `pnpm test` |
| Comms replay metrics | `pnpm run comms:replay` |
| Comms baseline refresh | `pnpm run comms:baseline` |
| Comms regression compare | `pnpm run comms:compare` |
| E2E tests (Playwright) | `pnpm run test:e2e` |
| Build frontend only | `pnpm run build:vite` |

### Non-obvious caveats

- **pnpm version**: The exact pnpm version is pinned via `packageManager` in `package.json`. Use `corepack enable && corepack prepare` to activate the correct version before installing.
- **Electron on headless Linux**: The dbus errors (`Failed to connect to the bus`) are expected and harmless in a headless/cloud environment. The app still runs fine with `$DISPLAY` set (e.g., `:1` via Xvfb/VNC).
- **`pnpm run lint` race condition**: If `pnpm run uv:download` was recently run, ESLint may fail with `ENOENT: no such file or directory, scandir '/workspace/temp_uv_extract'` because the temp directory was created and removed during download. Simply re-run lint after the download script finishes.
- **Build scripts warning**: `pnpm install` may warn about ignored build scripts for `@discordjs/opus` and `koffi`. These are optional messaging-channel dependencies and the warnings are safe to ignore.
- **`pnpm run init`**: This is a convenience script that runs `pnpm install` followed by `pnpm run uv:download`. Either run `pnpm run init` or run the two steps separately.
- **Gateway startup**: When running `pnpm dev`, the OpenClaw Gateway process starts automatically on port 18789. It takes ~10-30 seconds to become ready. Gateway readiness is not required for UI development—the app functions without it (shows "connecting" state).
- **No database**: The app uses `electron-store` (JSON files) and OS keychain. No database setup is needed.
- **AI Provider keys**: Actual AI chat requires at least one provider API key configured via Settings > AI Providers. The app is fully navigable and testable without keys.
- **Token usage history implementation**: Dashboard token usage history is not parsed from console logs. It reads OpenClaw session transcript `.jsonl` files under the local OpenClaw config directory, scans both configured agents and any runtime agent directories found on disk, and treats normal, `.deleted.jsonl`, and `.jsonl.reset.*` transcripts as valid history sources. It extracts assistant/tool usage records with `message.usage` and aggregates fields such as input/output/cache/total tokens and cost from those structured records.
- **Models page aggregation**: The 7-day/30-day filters are relative rolling windows, not calendar-month buckets. When grouped by time, the chart should keep all day buckets in the selected window; only model grouping is intentionally capped to the top entries.
- **OpenClaw Doctor in UI**: In Settings > Advanced > Developer, the app exposes both `Run Doctor` (`openclaw doctor --json`) and `Run Doctor Fix` (`openclaw doctor --fix --yes --non-interactive`) through the host-api. Renderer code should call the host route, not spawn CLI processes directly.
- **Renderer/Main API boundary (important)**:
  - Renderer must use `src/lib/host-api.ts` and `src/lib/api-client.ts` as the single entry for backend calls.
  - Do not add new direct `window.electron.ipcRenderer.invoke(...)` calls in pages/components; expose them through host-api/api-client instead.
  - Do not call Gateway HTTP endpoints directly from renderer (`fetch('http://127.0.0.1:18789/...')` etc.). Use Main-process proxy channels (`hostapi:fetch`, `gateway:httpProxy`) to avoid CORS/env drift.
  - Transport policy is Main-owned and fixed as `WS -> HTTP -> IPC fallback`; renderer should not implement protocol switching UI/business logic.
- **Comms-change checklist**: If your change touches communication paths (gateway events, runtime send/receive, delivery, or fallback), run `pnpm run comms:replay` and `pnpm run comms:compare` before pushing.
- **Doc sync rule**: After any functional or architecture change, review `README.md`, `README.zh-CN.md`, and `README.ja-JP.md` for required updates; if behavior/flows/interfaces changed, update docs in the same PR/commit.
- **Feature docs workflow**: Every new feature must have its own folder under `docs/<feature-slug>/`. At minimum create `design.md`, `testing.md`, `issues.md`, and `progress.md` before or alongside implementation. Keep those files updated as the source of truth for scope, verification, open problems, and delivery status.
- **Docs language rule**: All files under `docs/` must be written in Chinese. File names may stay English for consistency, but document content should be Chinese only unless a specific exception is requested.
记住开发原则，
1第一条：要求严格遵守**KISS, YAGNI, DRY, SOLID** **原则**。每次完成任务之前都要基于自我批评的方式进行思考当前的解决方案是否合理，逻辑是否自洽，性能是否高效。不可以用毫无事实根据的假设来解决问题，方法内部不可以加注释，尽量使用lamda表达式，所有的设计都要以真实的证据为准。这条准则不可以违背。
2第二条：我提出的修改以及方案建议，你先评估是否满足第一条，你必须要质疑并批评我，然后深度思考给出正确的积极的有价值的解决方案，特别强调不能一味的迎合我。