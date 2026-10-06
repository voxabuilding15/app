import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { darkColors, lightColors, type ColorScheme } from '@/theme/colors';

/** WCAG relative luminance of a #RRGGBB color. */
function luminance(hex: string): number {
  const channels = [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16) / 255);
  const [red, green, blue] = channels.map((value) =>
    value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
  ) as [number, number, number];
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (light + 0.05) / (dark + 0.05);
}

type Pair = [foreground: keyof ColorScheme, background: keyof ColorScheme];

/** Text in these colors sits on these backgrounds somewhere in the app: it needs 4.5 : 1. */
const TEXT: readonly Pair[] = [
  ['onSurface', 'background'],
  ['onSurface', 'surface'],
  ['onSurface', 'surfaceContainer'],
  ['onSurfaceVariant', 'background'],
  ['onSurfaceVariant', 'surface'],
  ['onSurfaceVariant', 'surfaceContainer'],
  ['primary', 'background'],
  ['primary', 'surface'],
  ['primary', 'surfaceContainer'],
  ['onPrimary', 'primary'],
  ['onPrimaryContainer', 'primaryContainer'],
  ['onSecondaryContainer', 'secondaryContainer'],
  ['error', 'background'],
  ['error', 'surface'],
  ['onErrorContainer', 'errorContainer'],
  ['success', 'background'],
  ['success', 'surface'],
  ['success', 'surfaceContainer'],
];

/** Borders and icons need 3 : 1 against what they sit on. */
const GRAPHICS: readonly Pair[] = [
  ['outline', 'background'],
  ['outline', 'surface'],
  ['primary', 'background'],
  ['warning', 'surface'],
  ['warning', 'background'],
];

for (const [name, colors] of [
  ['light', lightColors],
  ['dark', darkColors],
] as const) {
  describe(`${name} theme contrast`, () => {
    for (const [foreground, background] of TEXT) {
      it(`${foreground} text on ${background} reaches 4.5 : 1`, () => {
        const ratio = contrast(colors[foreground], colors[background]);
        assert.ok(
          ratio >= 4.5,
          `${colors[foreground]} on ${colors[background]} is ${ratio.toFixed(2)} : 1`,
        );
      });
    }
    for (const [foreground, background] of GRAPHICS) {
      it(`${foreground} borders and icons on ${background} reach 3 : 1`, () => {
        const ratio = contrast(colors[foreground], colors[background]);
        assert.ok(
          ratio >= 3,
          `${colors[foreground]} on ${colors[background]} is ${ratio.toFixed(2)} : 1`,
        );
      });
    }
  });
}

describe('achievement medals', () => {
  it('give white icons at least 3 : 1', async () => {
    const { TIER_COLORS } = await import('@/features/achievements/presentation/tiers');
    for (const [tier, color] of Object.entries(TIER_COLORS)) {
      const ratio = contrast('#FFFFFF', color);
      assert.ok(ratio >= 3, `${tier} ${color} is ${ratio.toFixed(2)} : 1`);
    }
  });
});
