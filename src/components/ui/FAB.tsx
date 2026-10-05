import { useHaptics } from '@/hooks';
import { radius, useTheme } from '@/theme';

import { Icon, type IconName } from './Icon';
import { PressableScale } from './PressableScale';

export interface FABProps {
  icon: IconName;
  label: string;
  onPress: () => void;
}

export function FAB({ icon, label, onPress }: FABProps) {
  const { colors } = useTheme();
  const haptics = useHaptics();

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => {
        haptics.light();
        onPress();
      }}
      style={{
        position: 'absolute',
        right: 16,
        bottom: 16,
        width: 56,
        height: 56,
        borderRadius: radius.lg,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.primaryContainer,
        elevation: 4,
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 3 },
      }}
    >
      <Icon name={icon} size={28} color={colors.onPrimaryContainer} />
    </PressableScale>
  );
}
