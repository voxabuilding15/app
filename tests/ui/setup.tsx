import 'react-native-gesture-handler/jestSetup';

jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: { View, createAnimatedComponent: (component: unknown) => component },
    useSharedValue: (initial: number) => {
      const box = { value: initial };
      return { get: () => box.value, set: (next: number) => void (box.value = next) };
    },
    useAnimatedStyle: (factory: () => object) => factory(),
    withSpring: (value: number) => value,
    useEvent: () => () => undefined,
  };
});

// Renders both action panels so tests can press swipe actions without simulating gestures.
jest.mock('react-native-gesture-handler/ReanimatedSwipeable', () => {
  const React = require('react');
  const { View } = require('react-native');
  const Swipeable = React.forwardRef(
    (
      props: {
        children?: React.ReactNode;
        renderLeftActions?: () => React.ReactNode;
        renderRightActions?: () => React.ReactNode;
      },
      ref: React.Ref<unknown>,
    ) => {
      React.useImperativeHandle(ref, () => ({ close: () => undefined }));
      return (
        <View>
          {props.renderLeftActions?.()}
          {props.children}
          {props.renderRightActions?.()}
        </View>
      );
    },
  );
  return { __esModule: true, default: Swipeable };
});
jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);

jest.mock('react-native-mmkv', () => {
  const stores = new Map<string, Map<string, string | number | boolean>>();
  return {
    createMMKV: ({ id }: { id: string }) => {
      const data = stores.get(id) ?? new Map();
      stores.set(id, data);
      return {
        getString: (key: string) => data.get(key) as string | undefined,
        set: (key: string, value: string | number | boolean) => void data.set(key, value),
        remove: (key: string) => data.delete(key),
      };
    },
  };
});

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  selectionAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning' },
}));

jest.mock('expo-router/drawer', () => ({ DrawerToggleButton: () => null }));

jest.mock('@react-native-community/datetimepicker', () => ({
  DateTimePickerAndroid: { open: jest.fn() },
}));

const mockRouter = { push: jest.fn(), back: jest.fn(), navigate: jest.fn() };

jest.mock('expo-router', () => {
  const React = require('react');
  return {
    useRouter: () => mockRouter,
    useNavigation: () => ({
      addListener: () => () => undefined,
      getParent: () => undefined,
      dispatch: jest.fn(),
    }),
    useLocalSearchParams: () => ({}),
    useFocusEffect: (callback: () => void) => React.useEffect(callback, [callback]),
    // Renders the header buttons screens put in navigator options so tests can press them.
    Stack: {
      Screen: ({ options }: { options?: { headerRight?: () => React.ReactNode } }) =>
        React.createElement(React.Fragment, null, options?.headerRight?.()),
    },
  };
});
