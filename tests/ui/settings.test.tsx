import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Alert, Linking, Share } from 'react-native';

import { readPrivacy } from '@/core';
import { FeedbackScreen } from '@/features/settings/presentation/screens/FeedbackScreen';
import { SettingsScreen } from '@/features/settings/presentation/screens/SettingsScreen';
import { useLanguageStore } from '@/i18n/store';

import { createSeeder } from '../support/seed';

import { createApp, renderWithApp, router } from './harness';

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 400, height: 800, scale: 2, fontScale: 1 }),
}));

afterEach(() => {
  jest.restoreAllMocks();
  useLanguageStore.setState({ preference: 'system' });
});

describe('SettingsScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('has a section for everything: appearance, language, notifications, privacy, data, security, feedback and about', async () => {
    await renderWithApp(<SettingsScreen />);
    for (const title of [
      'Appearance',
      'Language',
      'Notifications',
      'Privacy',
      'Data',
      'Security',
      'Feedback',
      'About',
    ]) {
      expect((await screen.findAllByText(title)).length).toBeGreaterThan(0);
    }
    expect(screen.getByText('Version 1.0.0')).toBeTruthy();
    expect(screen.getByText('Works without internet')).toBeTruthy();
  });

  it('switches the whole screen to French and back', async () => {
    await renderWithApp(<SettingsScreen />);
    await fireEvent.press(await screen.findByLabelText('Français'));
    expect(await screen.findByText('Paramètres')).toBeTruthy();
    expect(screen.getByText('Apparence')).toBeTruthy();
    expect(screen.getAllByLabelText('Système')).toHaveLength(2);
    await fireEvent.press(screen.getByLabelText('English'));
    expect(await screen.findByText('Appearance')).toBeTruthy();
  });

  it('follows a French phone when the language is left on System', async () => {
    const original = Intl.DateTimeFormat;
    jest
      .spyOn(Intl, 'DateTimeFormat')
      .mockImplementation(
        (...args: ConstructorParameters<typeof Intl.DateTimeFormat>) =>
          new original(args[0] ?? 'fr-FR', args[1]) as Intl.DateTimeFormat,
      );
    await renderWithApp(<SettingsScreen />);
    expect(await screen.findByText('Apparence')).toBeTruthy();
  });

  it('opens the backup screen and shows what is stored', async () => {
    const app = createApp();
    createSeeder(app.container.db, () => Date.now()).addTask('One', { createdAt: 5 });
    await renderWithApp(<SettingsScreen />, app);
    expect(await screen.findByText(/^Tasks 1 · Habits 0 ·/)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Backup and restore'));
    expect(router.push).toHaveBeenCalledWith('/settings/backup');
  });

  it('opens the security and feedback screens', async () => {
    await renderWithApp(<SettingsScreen />);
    await fireEvent.press(await screen.findByLabelText('App lock'));
    expect(router.push).toHaveBeenCalledWith('/settings/security');
    await fireEvent.press(screen.getByLabelText('Send feedback'));
    expect(router.push).toHaveBeenCalledWith('/settings/feedback');
  });
});

describe('notification settings', () => {
  beforeEach(() => jest.clearAllMocks());

  it('offers to allow notifications when they are not', async () => {
    const app = createApp();
    app.notifications.getPermissionState = async () => 'undetermined';
    const request = jest.spyOn(app.notifications, 'requestPermission');
    await renderWithApp(<SettingsScreen />, app);
    expect(await screen.findByText('Notifications have not been allowed yet')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Allow notifications'));
    expect(request).toHaveBeenCalled();
  });

  it('points to the system settings when they are blocked', async () => {
    const app = createApp();
    app.notifications.getPermissionState = async () => 'denied';
    const open = jest.spyOn(Linking, 'openSettings').mockResolvedValue();
    await renderWithApp(<SettingsScreen />, app);
    await fireEvent.press(await screen.findByLabelText('Open system settings'));
    expect(open).toHaveBeenCalled();
  });

  it('sends a test notification and opens the system categories', async () => {
    const app = createApp();
    const open = jest.spyOn(Linking, 'openSettings').mockResolvedValue();
    await renderWithApp(<SettingsScreen />, app);
    await fireEvent.press(await screen.findByLabelText('Send a test notification'));
    expect(await screen.findByText('Test notification sent')).toBeTruthy();
    expect(app.notifications.presented.at(-1)).toMatchObject({
      title: 'FocusFlow',
      body: 'Notifications are working',
    });
    await fireEvent.press(screen.getByLabelText('Manage categories in system settings'));
    expect(open).toHaveBeenCalled();
  });
});

describe('privacy settings', () => {
  it('remembers whether notification details are hidden', async () => {
    const app = createApp();
    await renderWithApp(<SettingsScreen />, app);
    const toggle = await screen.findByLabelText('Hide notification details');
    expect(toggle.props.value).toBe(false);
    await fireEvent(toggle, 'valueChange', true);
    await waitFor(() =>
      expect(readPrivacy(app.container.storage).hideNotificationDetails).toBe(true),
    );
  });
});

describe('deleting all data', () => {
  beforeEach(() => jest.clearAllMocks());

  async function ready() {
    const app = createApp();
    createSeeder(app.container.db, () => Date.now()).addTask('Gone soon', { createdAt: 5 });
    await app.backup.create('manual', false);
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await renderWithApp(<SettingsScreen />, app);
    await fireEvent.press(await screen.findByLabelText('Delete all data'));
    const buttons = alert.mock.calls[0]?.[2] ?? [];
    return { app, buttons };
  }
  const tasks = (app: ReturnType<typeof createApp>) =>
    app.container.db.getFirstSync<{ n: number }>('SELECT COUNT(*) AS n FROM tasks')?.n;

  it('asks first, and does nothing when cancelled', async () => {
    const { app, buttons } = await ready();
    expect(buttons.map((button) => button.text)).toEqual([
      'Cancel',
      'Delete, keep a safety copy',
      'Delete everything',
    ]);
    expect(tasks(app)).toBe(1);
  });

  it('deletes everything and keeps a safety copy when asked to', async () => {
    const { app, buttons } = await ready();
    buttons.find((button) => button.text === 'Delete, keep a safety copy')?.onPress?.();
    expect(
      await screen.findByText('All data deleted. A safety copy was kept in your backups.'),
    ).toBeTruthy();
    expect(tasks(app)).toBe(0);
    expect(
      (await app.deviceFiles.list('documents', 'backups')).some((file) =>
        file.name.endsWith('-safety.json'),
      ),
    ).toBe(true);
  });

  it('deletes everything including every backup', async () => {
    const { app, buttons } = await ready();
    buttons.find((button) => button.text === 'Delete everything')?.onPress?.();
    expect(await screen.findByText('All data deleted.')).toBeTruthy();
    expect(tasks(app)).toBe(0);
    expect(await app.deviceFiles.list('documents', 'backups')).toHaveLength(0);
  });
});

describe('FeedbackScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('asks for a message before sharing anything', async () => {
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction });
    await renderWithApp(<FeedbackScreen />);
    await fireEvent.press(await screen.findByLabelText('Share feedback'));
    expect(await screen.findByText('Write a few words first')).toBeTruthy();
    expect(share).not.toHaveBeenCalled();
  });

  it('shares the message with the technical details, and thanks the person', async () => {
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction });
    await renderWithApp(<FeedbackScreen />);
    await fireEvent.press(await screen.findByLabelText('Problem'));
    await fireEvent.changeText(screen.getByLabelText('Your message'), 'The timer stops');
    await fireEvent.press(screen.getByLabelText('Share feedback'));
    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    const [content] = share.mock.calls[0]!;
    expect(content.title).toBe('FocusFlow 1.0.0 – Problem report');
    expect(content.message).toContain('The timer stops');
    expect(content.message).toContain('App version: 1.0.0');
    expect(await screen.findByText('Thank you for your feedback')).toBeTruthy();
    expect(screen.getByLabelText('Your message').props.value).toBe('');
  });

  it('can leave the technical details out, and keeps the text when sharing is cancelled', async () => {
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.dismissedAction });
    await renderWithApp(<FeedbackScreen />);
    await fireEvent(
      await screen.findByLabelText('Include technical details'),
      'valueChange',
      false,
    );
    await fireEvent.changeText(screen.getByLabelText('Your message'), 'Just a thought');
    await fireEvent.press(screen.getByLabelText('Share feedback'));
    await waitFor(() => expect(share).toHaveBeenCalled());
    expect(share.mock.calls[0]![0].message).not.toContain('App version');
    expect(screen.getByLabelText('Your message').props.value).toBe('Just a thought');
    expect(screen.queryByText('Thank you for your feedback')).toBeNull();
  });

  it('says so when the share sheet cannot open', async () => {
    jest.spyOn(Share, 'share').mockRejectedValue(new Error('no'));
    await renderWithApp(<FeedbackScreen />);
    await fireEvent.changeText(await screen.findByLabelText('Your message'), 'Hello');
    await fireEvent.press(screen.getByLabelText('Share feedback'));
    expect(await screen.findByText("Couldn't open the share sheet")).toBeTruthy();
  });
});
