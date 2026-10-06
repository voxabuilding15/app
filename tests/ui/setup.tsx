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

// The phone is set to English, so tests see the same text as before.
jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageTag: 'en-US', languageCode: 'en', textDirection: 'ltr' }],
}));

jest.mock('react-native-restart', () => ({
  __esModule: true,
  default: { restart: jest.fn(), Restart: jest.fn(), getReason: jest.fn(async () => null) },
}));

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

// Native modules the Notes feature uses. The state object lets tests steer what they do.
jest.mock('expo-audio', () => {
  const state = {
    permission: true,
    uri: 'file:///cache/recording.m4a' as string | null,
    durationMillis: 4200,
    playing: false,
  };
  const recorder = {
    get uri() {
      return state.uri;
    },
    prepareToRecordAsync: jest.fn(async () => undefined),
    record: jest.fn(),
    stop: jest.fn(async () => undefined),
    getStatus: () => ({ durationMillis: state.durationMillis, isRecording: true }),
  };
  const player = {
    play: jest.fn(() => {
      state.playing = true;
    }),
    pause: jest.fn(() => {
      state.playing = false;
    }),
    seekTo: jest.fn(async () => undefined),
  };
  // Looping players for the ambient sound and the tick, which the tests inspect.
  const loops: {
    source: unknown;
    loop: boolean;
    volume: number;
    play: jest.Mock;
    remove: jest.Mock;
    setActiveForLockScreen: jest.Mock;
    clearLockScreenControls: jest.Mock;
  }[] = [];
  return {
    __state: state,
    __recorder: recorder,
    __player: player,
    __loops: loops,
    createAudioPlayer: jest.fn((source: unknown) => {
      const created = {
        source,
        loop: false,
        volume: 1,
        play: jest.fn(),
        remove: jest.fn(),
        setActiveForLockScreen: jest.fn(),
        clearLockScreenControls: jest.fn(),
      };
      loops.push(created);
      return created;
    }),
    RecordingPresets: { HIGH_QUALITY: {} },
    requestRecordingPermissionsAsync: jest.fn(async () => ({ granted: state.permission })),
    setAudioModeAsync: jest.fn(async () => undefined),
    useAudioRecorder: () => recorder,
    useAudioPlayer: () => player,
    useAudioPlayerStatus: () => ({
      playing: state.playing,
      currentTime: 0,
      didJustFinish: false,
    }),
  };
});

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(async () => true),
  shareAsync: jest.fn(async () => undefined),
}));

jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: jest.fn(async () => true),
  isEnrolledAsync: jest.fn(async () => true),
  authenticateAsync: jest.fn(async () => ({ success: true })),
}));

jest.mock('expo-file-system', () => ({
  File: class {},
  Directory: class {},
  Paths: { document: '' },
}));
