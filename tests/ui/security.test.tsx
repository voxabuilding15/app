import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Alert, AppState, Text } from 'react-native';

import { getSettingsModule } from '@/features/settings/presentation/module';
import { AppLockGate } from '@/features/settings/presentation/components/AppLockGate';
import { SecurityScreen } from '@/features/settings/presentation/screens/SecurityScreen';

import { createSeeder } from '../support/seed';

import { createApp, renderWithApp } from './harness';

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 400, height: 800, scale: 2, fontScale: 1 }),
}));

afterEach(() => jest.restoreAllMocks());

const settings = async (app: ReturnType<typeof createApp>) => getSettingsModule(app.container);

describe('SecurityScreen', () => {
  it('starts with the app unlocked and offers the ways to lock it', async () => {
    await renderWithApp(<SecurityScreen />);
    expect(await screen.findByText('App lock')).toBeTruthy();
    expect(screen.getByLabelText('PIN')).toBeTruthy();
    expect(screen.getByLabelText('Fingerprint, face or screen lock')).toBeTruthy();
    expect(screen.getByLabelText('Off').props.accessibilityState.selected).toBe(true);
    expect(screen.queryByText('Lock when I leave the app')).toBeNull();
  });

  it('sets a PIN typed twice, then offers how soon to lock', async () => {
    const app = createApp();
    await renderWithApp(<SecurityScreen />, app);
    await fireEvent.press(await screen.findByLabelText('PIN'));

    await fireEvent.changeText(await screen.findByLabelText('New PIN'), '1234');
    await fireEvent.changeText(screen.getByLabelText('Repeat PIN'), '1235');
    await fireEvent.press(screen.getByLabelText('Save PIN'));
    expect(await screen.findByText('The two PINs do not match')).toBeTruthy();

    await fireEvent.changeText(screen.getByLabelText('Repeat PIN'), '1234');
    await fireEvent.press(screen.getByLabelText('Save PIN'));
    expect(await screen.findByText('Your PIN is set')).toBeTruthy();
    expect((await settings(app)).appLock.method()).toBe('pin');

    expect(await screen.findByText('Lock when I leave the app')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Immediately'));
    await waitFor(async () =>
      expect((await settings(app)).security.read().lockDelaySeconds).toBe(0),
    );
  });

  it('rejects a PIN that is too short', async () => {
    await renderWithApp(<SecurityScreen />);
    await fireEvent.press(await screen.findByLabelText('PIN'));
    await fireEvent.changeText(await screen.findByLabelText('New PIN'), '12');
    await fireEvent.changeText(screen.getByLabelText('Repeat PIN'), '12');
    await fireEvent.press(screen.getByLabelText('Save PIN'));
    expect(await screen.findByText('Use 4 to 8 digits')).toBeTruthy();
  });

  it('uses the phone’s lock, and says when the phone has none set up', async () => {
    const app = createApp();
    await renderWithApp(<SecurityScreen />, app);
    app.noteFakes.authenticator.available = false;
    await fireEvent.press(await screen.findByLabelText('Fingerprint, face or screen lock'));
    expect(
      await screen.findByText(
        /^Set up a fingerprint, face or screen lock in your phone settings first/,
      ),
    ).toBeTruthy();

    app.noteFakes.authenticator.available = true;
    await fireEvent.press(screen.getByLabelText('Fingerprint, face or screen lock'));
    expect(await screen.findByText('The app now uses your phone’s lock')).toBeTruthy();
    expect((await settings(app)).appLock.method()).toBe('device');
  });

  it('turns the lock off again', async () => {
    const app = createApp();
    await (await settings(app)).appLock.usePin('1234');
    await renderWithApp(<SecurityScreen />, app);
    await fireEvent.press(await screen.findByLabelText('Off'));
    expect(await screen.findByText('Locking is off')).toBeTruthy();
    expect((await settings(app)).appLock.method()).toBe('none');
  });
});

describe('AppLockGate', () => {
  const Child = () => <Text>Secret content</Text>;

  async function locked(pin = '1234') {
    const app = createApp();
    const { appLock } = await settings(app);
    await appLock.usePin(pin);
    appLock.lockNow();
    return app;
  }

  /** Lets the test play the part of the system telling the app it went to the background. */
  function appState() {
    let listener: ((state: string) => void) | undefined;
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, callback) => {
      listener = callback as (state: string) => void;
      return { remove: () => undefined };
    });
    return (state: string) => act(async () => listener?.(state));
  }

  it('shows the app as it is when no lock is set', async () => {
    await renderWithApp(
      <AppLockGate>
        <Child />
      </AppLockGate>,
    );
    expect(await screen.findByText('Secret content')).toBeTruthy();
    expect(screen.queryByText('FocusFlow is locked')).toBeNull();
  });

  it('covers the app until the right PIN is typed, hiding it from screen readers', async () => {
    const app = await locked();
    await renderWithApp(
      <AppLockGate>
        <Child />
      </AppLockGate>,
      app,
    );
    expect(await screen.findByText('FocusFlow is locked')).toBeTruthy();
    expect(screen.queryByText('Secret content')).toBeNull();

    await fireEvent.changeText(screen.getByLabelText('PIN'), '0000');
    await fireEvent.press(screen.getByLabelText('Unlock'));
    expect(await screen.findByText('Wrong PIN. 4 tries left.')).toBeTruthy();

    await fireEvent.changeText(screen.getByLabelText('PIN'), '1234');
    await fireEvent.press(screen.getByLabelText('Unlock'));
    expect(await screen.findByText('Secret content')).toBeTruthy();
    expect(screen.queryByText('FocusFlow is locked')).toBeNull();
  });

  it('asks the phone straight away when the lock uses the phone’s own', async () => {
    const app = createApp();
    const { appLock } = await settings(app);
    await appLock.useDeviceAuth();
    appLock.lockNow();
    const before = app.noteFakes.authenticator.prompts.length;
    await renderWithApp(
      <AppLockGate>
        <Child />
      </AppLockGate>,
      app,
    );
    expect(await screen.findByText('Secret content')).toBeTruthy();
    expect(app.noteFakes.authenticator.prompts.length).toBeGreaterThan(before);
    expect(app.noteFakes.authenticator.prompts.at(-1)).toBe('Unlock your app');
  });

  it('stays locked when the phone check is cancelled, and tries again on request', async () => {
    const app = createApp();
    const { appLock } = await settings(app);
    await appLock.useDeviceAuth();
    appLock.lockNow();
    app.noteFakes.authenticator.accepts = false;
    await renderWithApp(
      <AppLockGate>
        <Child />
      </AppLockGate>,
      app,
    );
    expect(await screen.findByText('FocusFlow is locked')).toBeTruthy();
    app.noteFakes.authenticator.accepts = true;
    await fireEvent.press(screen.getByLabelText('Unlock'));
    expect(await screen.findByText('Secret content')).toBeTruthy();
  });

  it('locks again at once when set to lock immediately and the app goes to the background', async () => {
    const send = appState();
    const app = createApp();
    const module = await settings(app);
    await module.appLock.usePin('1234');
    module.security.write({ lockDelaySeconds: 0 });
    await renderWithApp(
      <AppLockGate>
        <Child />
      </AppLockGate>,
      app,
    );
    expect(await screen.findByText('Secret content')).toBeTruthy();
    await send('background');
    expect(await screen.findByText('FocusFlow is locked')).toBeTruthy();
  });

  it('locks only after the chosen time away', async () => {
    const send = appState();
    const app = createApp();
    const module = await settings(app);
    await module.appLock.usePin('1234');
    module.security.write({ lockDelaySeconds: 60 });
    const now = jest.spyOn(Date, 'now');
    const start = Date.now();
    await renderWithApp(
      <AppLockGate>
        <Child />
      </AppLockGate>,
      app,
    );
    expect(await screen.findByText('Secret content')).toBeTruthy();

    now.mockReturnValue(start);
    await send('background');
    now.mockReturnValue(start + 30_000);
    await send('active');
    expect(screen.getByText('Secret content')).toBeTruthy();

    now.mockReturnValue(start + 40_000);
    await send('background');
    now.mockReturnValue(start + 40_000 + 61_000);
    await send('active');
    expect(await screen.findByText('FocusFlow is locked')).toBeTruthy();
  });

  it('lets someone who forgot the PIN back in only by erasing the data and the lock', async () => {
    const app = await locked();
    createSeeder(app.container.db, () => Date.now()).addTask('Private', { createdAt: 5 });
    await app.backup.create('manual', false);
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await renderWithApp(
      <AppLockGate>
        <Child />
      </AppLockGate>,
      app,
    );

    await fireEvent.press(await screen.findByLabelText('Forgot your PIN?'));
    const buttons = alert.mock.calls[0]?.[2] ?? [];
    expect(buttons.map((button) => button.text)).toEqual(['Cancel', 'Erase and reset']);
    expect(screen.getByText('FocusFlow is locked')).toBeTruthy();

    buttons.find((button) => button.text === 'Erase and reset')?.onPress?.();
    expect(await screen.findByText('Secret content')).toBeTruthy();
    expect(app.container.db.getFirstSync<{ n: number }>('SELECT COUNT(*) AS n FROM tasks')?.n).toBe(
      0,
    );
    // No safety copy is left behind for anyone to restore.
    expect(await app.deviceFiles.list('documents', 'backups')).toHaveLength(0);
    expect((await settings(app)).appLock.method()).toBe('none');
  });

  it('lets the lock be turned off when the phone no longer has a screen lock', async () => {
    const app = createApp();
    const { appLock } = await settings(app);
    await appLock.useDeviceAuth();
    appLock.lockNow();
    app.noteFakes.authenticator.available = false;
    await renderWithApp(
      <AppLockGate>
        <Child />
      </AppLockGate>,
      app,
    );
    await fireEvent.press(await screen.findByLabelText('Turn off app lock'));
    expect(await screen.findByText('Secret content')).toBeTruthy();
    expect(appLock.method()).toBe('none');
  });
});
