import type { Tier } from '../domain/catalog';

/** Medal colors, readable on both light and dark surfaces. */
export const TIER_COLORS: Record<Tier, string> = {
  bronze: '#B4682A',
  silver: '#6B7280',
  gold: '#C28A00',
  platinum: '#4F7CAC',
};
