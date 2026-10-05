import { useWindowDimensions } from 'react-native';

import { TABLET_BREAKPOINT } from '@/theme';

export function useIsTablet(): boolean {
  const { width } = useWindowDimensions();
  return width >= TABLET_BREAKPOINT;
}
