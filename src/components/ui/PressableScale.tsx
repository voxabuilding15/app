import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

export interface PressableScaleProps extends Omit<PressableProps, 'style'> {
  style?: StyleProp<ViewStyle>;
  pressedScale?: number;
}

export function PressableScale({
  style,
  pressedScale = 0.97,
  onPressIn,
  onPressOut,
  children,
  ...rest
}: PressableScaleProps) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  return (
    <Animated.View style={[animatedStyle, style]}>
      <Pressable
        {...rest}
        onPressIn={(event) => {
          scale.set(withSpring(pressedScale, { damping: 20, stiffness: 300 }));
          onPressIn?.(event);
        }}
        onPressOut={(event) => {
          scale.set(withSpring(1, { damping: 20, stiffness: 300 }));
          onPressOut?.(event);
        }}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}
