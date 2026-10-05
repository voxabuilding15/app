import { useWindowDimensions } from 'react-native';

import { TABLET_MIN_DIMENSION } from '@/theme';

/** True on tablets in either orientation (smallest side >= 600dp), false on phones. */
export function useIsTablet(): boolean {
  const { width, height } = useWindowDimensions();
  return Math.min(width, height) >= TABLET_MIN_DIMENSION;
}
