/** Applies an opacity (0 to 1) to a `#RRGGBB` color, returning `#RRGGBBAA`. */
export function withAlpha(hex: string, alpha: number): string {
  const clamped = Math.min(1, Math.max(0, alpha));
  return `${hex}${Math.round(clamped * 255)
    .toString(16)
    .padStart(2, '0')}`;
}
