import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const PATCH_PATH = path.resolve('patches/openclaw@2026.3.13.patch');
const EXPECTED_FILES = [
  'dist/auth-profiles-DRjqKE3G.js',
  'dist/auth-profiles-DDVivXkv.js',
  'dist/discord-CcCLMjHw.js',
  'dist/model-selection-46xMp11W.js',
  'dist/model-selection-CU2b7bN6.js',
  'dist/plugin-sdk/thread-bindings-SYAnWHuW.js',
  'dist/reply-Bm8VrLQh.js',
];

describe('openclaw exec approval patch', () => {
  it('patches every bundled exec follow-up implementation to keep desktop sessions internal', async () => {
    const patch = await fs.readFile(PATCH_PATH, 'utf8');

    for (const file of EXPECTED_FILES) {
      const escaped = file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      expect(patch.match(new RegExp(`diff --git a/${escaped} b/${escaped}`, 'g'))?.length).toBe(2);
    }

    expect(patch.match(/\+function buildExecApprovalFollowupMessage\(resultText\) \{/g)?.length).toBe(EXPECTED_FILES.length);
    expect(patch.match(/\+	if \(!canDeliverDirectly\) \{/g)?.length).toBe(EXPECTED_FILES.length);
    expect(patch.match(/\+		await callGatewayTool\("chat.inject", \{ timeoutMs: 6e4 \}, \{/g)?.length).toBe(EXPECTED_FILES.length);
    expect(patch.match(/\+			message: buildExecApprovalFollowupMessage\(resultText\)/g)?.length).toBe(EXPECTED_FILES.length);
    expect(patch.match(/\+	if \(isInternalMessageChannel\(params\.command\.channel\)\) return \{/g)?.length).toBe(EXPECTED_FILES.length);
    expect(patch.match(/deliver: canDeliverDirectly,/g)?.length ?? 0).toBeGreaterThanOrEqual(5);
    expect(patch.match(/bestEffortDeliver: canDeliverDirectly,/g)?.length ?? 0).toBeGreaterThanOrEqual(5);
  });
});
