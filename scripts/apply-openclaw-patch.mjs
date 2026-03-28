import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const openclawDir = join(root, 'node_modules', 'openclaw');
const patchPath = join(root, 'patches', 'openclaw@2026.3.13.patch');
const followupFile = join(openclawDir, 'dist', 'auth-profiles-DDVivXkv.js');
const replyFile = join(openclawDir, 'dist', 'reply-Bm8VrLQh.js');
const followupMarker = 'buildExecApprovalFollowupMessage';
const replyMarker = 'if (isInternalMessageChannel(params.command.channel)) return {';

const hasMarker = (file, marker) => existsSync(file) && readFileSync(file, 'utf8').includes(marker);

if (!existsSync(openclawDir)) {
  console.error('openclaw package not found. Run pnpm install first.');
  process.exit(1);
}

if (!existsSync(patchPath)) {
  console.error(`openclaw patch not found: ${patchPath}`);
  process.exit(1);
}

if (hasMarker(followupFile, followupMarker) && hasMarker(replyFile, replyMarker)) {
  console.log('openclaw patch already applied');
  process.exit(0);
}

const cwd = realpathSync(openclawDir);

try {
  execFileSync('patch', ['--dry-run', '-p1', '-i', patchPath], { cwd, stdio: 'pipe' });
  execFileSync('patch', ['--forward', '-p1', '-i', patchPath], { cwd, stdio: 'inherit' });
  console.log('openclaw patch applied');
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`failed to apply openclaw patch: ${message}`);
  process.exit(1);
}
