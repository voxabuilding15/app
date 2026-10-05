import { View } from 'react-native';

import { Icon, type IconName } from '@/components';
import { withAlpha } from '@/theme';

interface HabitIconBubbleProps {
  icon: string;
  color: string;
  size?: number;
}

/** A habit's icon on a soft circle of its own color. */
export function HabitIconBubble({ icon, color, size = 44 }: HabitIconBubbleProps) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: withAlpha(color, 0.18),
      }}
    >
      <Icon name={icon as IconName} size={size * 0.55} color={color} />
    </View>
  );
}
