import { describe, expect, it } from 'vitest';
import sharp from 'sharp';

describe('chat welcome wordmark asset', () => {
  it('keeps the visible wordmark centered within the exported mask bounds', async () => {
    const { data, info } = await sharp('src/assets/xclaw-wordmark-mask.png').ensureAlpha().raw().toBuffer({ resolveWithObject: true });

    let minX = info.width;
    let minY = info.height;
    let maxX = -1;
    let maxY = -1;

    for (let y = 0; y < info.height; y += 1) {
      for (let x = 0; x < info.width; x += 1) {
        const alpha = data[(y * info.width + x) * 4 + 3];
        if (alpha <= 10) continue;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }

    const leftPadding = minX;
    const rightPadding = info.width - maxX - 1;
    const contentWidth = maxX - minX + 1;

    expect(contentWidth / info.width).toBeGreaterThan(0.9);
    expect(Math.abs(leftPadding - rightPadding)).toBeLessThanOrEqual(6);
  });
});
