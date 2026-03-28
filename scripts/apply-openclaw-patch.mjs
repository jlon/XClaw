import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const openclawDir = join(root, 'node_modules', 'openclaw');
const patchPath = join(root, 'patches', 'openclaw@2026.3.13.patch');
const followupFile = join(openclawDir, 'dist', 'auth-profiles-DDVivXkv.js');
const replyFile = join(openclawDir, 'dist', 'reply-Bm8VrLQh.js');
const followupMarker = 'buildExecApprovalFollowupMessage';
const replyMarker = 'if (isInternalMessageChannel(params.command.channel)) return {';
const candidateFiles = [
  'dist/auth-profiles-DDVivXkv.js',
  'dist/auth-profiles-DRjqKE3G.js',
  'dist/discord-CcCLMjHw.js',
  'dist/model-selection-46xMp11W.js',
  'dist/model-selection-CU2b7bN6.js',
  'dist/plugin-sdk/thread-bindings-SYAnWHuW.js',
  'dist/reply-Bm8VrLQh.js',
];
const cleanFollowupBlock = `function buildExecApprovalFollowupPrompt(resultText) {
\treturn [
\t\t"An async command the user already approved has completed.",
\t\t"Do not run the command again.",
\t\t"",
\t\t"Exact completion details:",
\t\tresultText.trim(),
\t\t"",
\t\t"Reply to the user in a helpful way.",
\t\t"If it succeeded, share the relevant output.",
\t\t"If it failed, explain what went wrong."
\t].join("\\n");
}
async function sendExecApprovalFollowup(params) {
\tconst sessionKey = params.sessionKey?.trim();
\tconst resultText = params.resultText.trim();
\tif (!sessionKey || !resultText) return false;
\tconst channel = params.turnSourceChannel?.trim();
\tconst to = params.turnSourceTo?.trim();
\tconst threadId = params.turnSourceThreadId != null && params.turnSourceThreadId !== "" ? String(params.turnSourceThreadId) : void 0;
\tawait callGatewayTool("agent", { timeoutMs: 6e4 }, {
\t\tsessionKey,
\t\tmessage: buildExecApprovalFollowupPrompt(resultText),
\t\tdeliver: true,
\t\tbestEffortDeliver: true,
\t\tchannel: channel && to ? channel : void 0,
\t\tto: channel && to ? to : void 0,
\t\taccountId: channel && to ? params.turnSourceAccountId?.trim() || void 0 : void 0,
\t\tthreadId: channel && to ? threadId : void 0,
\t\tidempotencyKey: \`exec-approval-followup:\${params.approvalId}\`
\t}, { expectFinal: true });
\treturn true;
}`;
const patchedFollowupBlock = `function buildExecApprovalFollowupPrompt(resultText) {
\treturn [
\t\t"An async command the user already approved has completed.",
\t\t"Do not run the command again.",
\t\t"",
\t\t"Exact completion details:",
\t\tresultText.trim(),
\t\t"",
\t\t"Reply to the user in a helpful way.",
\t\t"If it succeeded, share the relevant output.",
\t\t"If it failed, explain what went wrong."
\t].join("\\n");
}
function buildExecApprovalFollowupMessage(resultText) {
\treturn [
\t\t"Command update:",
\t\t"",
\t\tresultText.trim()
\t].join("\\n");
}
async function sendExecApprovalFollowup(params) {
\tconst sessionKey = params.sessionKey?.trim();
\tconst resultText = params.resultText.trim();
\tif (!sessionKey || !resultText) return false;
\tconst channel = params.turnSourceChannel?.trim();
\tconst to = params.turnSourceTo?.trim();
\tconst canDeliverDirectly = Boolean(channel && to);
\tconst threadId = params.turnSourceThreadId != null && params.turnSourceThreadId !== "" ? String(params.turnSourceThreadId) : void 0;
\tif (!canDeliverDirectly) {
\t\tawait callGatewayTool("chat.inject", { timeoutMs: 6e4 }, {
\t\t\tsessionKey,
\t\t\tmessage: buildExecApprovalFollowupMessage(resultText)
\t\t});
\t\treturn true;
\t}
\tawait callGatewayTool("agent", { timeoutMs: 6e4 }, {
\t\tsessionKey,
\t\tmessage: buildExecApprovalFollowupPrompt(resultText),
\t\tdeliver: canDeliverDirectly,
\t\tbestEffortDeliver: canDeliverDirectly,
\t\tchannel: canDeliverDirectly ? channel : void 0,
\t\tto: canDeliverDirectly ? to : void 0,
\t\taccountId: canDeliverDirectly ? params.turnSourceAccountId?.trim() || void 0 : void 0,
\t\tthreadId: canDeliverDirectly ? threadId : void 0,
\t\tidempotencyKey: \`exec-approval-followup:\${params.approvalId}\`
\t}, { expectFinal: true });
\treturn true;
}`;
const cleanApprovalBlock = `return {
\t\t\tshouldContinue: false,
\t\t\treply: { text: \`❌ Failed to submit approval: \${String(err)}\` }
\t\t};
\t}
\treturn {
\t\tshouldContinue: false,
\t\treply: { text: \`✅ Exec approval \${parsed.decision} submitted for \${parsed.id}.\` }
\t};
};`;
const patchedApprovalBlock = `return {
\t\t\tshouldContinue: false,
\t\t\treply: { text: \`❌ Failed to submit approval: \${String(err)}\` }
\t\t};
\t}
\tif (isInternalMessageChannel(params.command.channel)) return {
\t\tshouldContinue: false
\t};
\treturn {
\t\tshouldContinue: false,
\t\treply: { text: \`✅ Exec approval \${parsed.decision} submitted for \${parsed.id}.\` }
\t};
};`;

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
const applyFallbackTransforms = () => {
  let changed = 0;
  for (const relativePath of candidateFiles) {
    const target = join(cwd, relativePath);
    const current = readFileSync(target, 'utf8');
    let next = current;
    if (!next.includes(followupMarker)) {
      if (!next.includes(cleanFollowupBlock)) {
        throw new Error(`missing followup anchor in ${relativePath}`);
      }
      next = next.replace(cleanFollowupBlock, patchedFollowupBlock);
    }
    if (!next.includes(replyMarker)) {
      if (!next.includes(cleanApprovalBlock)) {
        throw new Error(`missing approval anchor in ${relativePath}`);
      }
      next = next.replace(cleanApprovalBlock, patchedApprovalBlock);
    }
    if (next !== current) {
      writeFileSync(target, next);
      changed += 1;
    }
  }
  console.log(changed > 0 ? 'openclaw patch applied' : 'openclaw patch already applied');
};

try {
  if (process.platform === 'win32') {
    applyFallbackTransforms();
    process.exit(0);
  }
  execFileSync('patch', ['--dry-run', '-p1', '-i', patchPath], { cwd, stdio: 'pipe' });
  execFileSync('patch', ['--forward', '-p1', '-i', patchPath], { cwd, stdio: 'inherit' });
  console.log('openclaw patch applied');
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`failed to apply openclaw patch: ${message}`);
  process.exit(1);
}
