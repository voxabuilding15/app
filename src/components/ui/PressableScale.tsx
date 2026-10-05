import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { useHaptics } from '@/hooks';

const SPRING = { damping: 20, stiffness: 300 } as const;

export interface PressableScaleProps extends Omit<PressableProps, 'style'> {
  style?: StyleProp<ViewStyle>;
  pressedScale?: number;
  /** Haptic feedback fired on press. Omit for none. */
  haptic?: 'light' | 'selection';
}

export function PressableScale({
  style,
  pressedScale = 0.97,
  haptic,
  onPress,
  onPressIn,
  onPressOut,
  children,
  ...rest
}: PressableScaleProps) {
  const haptics = useHaptics();
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  return (
    <Animated.View style={[animatedStyle, style]}>
      <Pressable
        {...rest}
        onPress={(event) => {
          if (haptic) {
            haptics[haptic]();
          }
          onPress?.(event);
        }}
        onPressIn={(event) => {
          scale.set(withSpring(pressedScale, SPRING));
          onPressIn?.(event);
        }}
        onPressOut={(event) => {
          scale.set(withSpring(1, SPRING));
          onPressOut?.(event);
        }}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}
