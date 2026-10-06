import { useRef, type PropsWithChildren } from 'react';
import { View } from 'react-native';
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';

import { MIN_TOUCH_TARGET, spacing } from '@/theme';
import { useTranslator } from '@/i18n';

import { Icon, type IconName } from './Icon';
import { PressableScale } from './PressableScale';
import { Text } from './Text';

export interface SwipeAction {
  label: string;
  icon: IconName;
  background: string;
  foreground: string;
  onPress: () => void;
}

export interface SwipeableRowProps extends PropsWithChildren {
  /** Revealed by swiping right. */
  leftActions?: readonly SwipeAction[];
  /** Revealed by swiping left. */
  rightActions?: readonly SwipeAction[];
  enabled?: boolean;
}

const ACTION_WIDTH = 88;

interface ActionPanelProps {
  actions: readonly SwipeAction[];
  onActionPress: () => void;
}

function ActionPanel({ actions, onActionPress }: ActionPanelProps) {
  const { t } = useTranslator();
  return (
    <View style={{ flexDirection: 'row' }}>
      {actions.map((action) => (
        <PressableScale
          key={action.label}
          accessibilityRole="button"
          accessibilityLabel={t(action.label)}
          pressedScale={0.97}
          onPress={() => {
            onActionPress();
            action.onPress();
          }}
          style={{ width: ACTION_WIDTH, backgroundColor: action.background }}
        >
          <View
            style={{
              minHeight: MIN_TOUCH_TARGET,
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              gap: spacing.xs,
            }}
          >
            <Icon name={action.icon} color={action.foreground} />
            <Text variant="labelSmall" style={{ color: action.foreground }}>
              {action.label}
            </Text>
          </View>
        </PressableScale>
      ))}
    </View>
  );
}

export function SwipeableRow({
  leftActions = [],
  rightActions = [],
  enabled = true,
  children,
}: SwipeableRowProps) {
  const ref = useRef<SwipeableMethods>(null);
  const close = () => ref.current?.close();

  if (!enabled || (leftActions.length === 0 && rightActions.length === 0)) {
    return <>{children}</>;
  }

  return (
    <ReanimatedSwipeable
      ref={ref}
      friction={2}
      overshootLeft={false}
      overshootRight={false}
      renderLeftActions={
        leftActions.length > 0
          ? () => <ActionPanel actions={leftActions} onActionPress={close} />
          : undefined
      }
      renderRightActions={
        rightActions.length > 0
          ? () => <ActionPanel actions={rightActions} onActionPress={close} />
          : undefined
      }
    >
      {children}
    </ReanimatedSwipeable>
  );
}
