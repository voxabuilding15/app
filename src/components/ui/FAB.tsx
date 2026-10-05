import { radius, spacing, useTheme } from '@/theme';

import { Icon, type IconName } from './Icon';
import { PressableScale } from './PressableScale';

const FAB_SIZE = 56;

export interface FABProps {
  icon: IconName;
  label: string;
  onPress: () => void;
}

export function FAB({ icon, label, onPress }: FABProps) {
  const { colors } = useTheme();

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      haptic="light"
      onPress={onPress}
      style={{
        position: 'absolute',
        right: spacing.lg,
        bottom: spacing.lg,
        width: FAB_SIZE,
        height: FAB_SIZE,
        borderRadius: radius.lg,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.primaryContainer,
        elevation: 4,
      }}
    >
      <Icon name={icon} size={28} color={colors.onPrimaryContainer} />
    </PressableScale>
  );
}
