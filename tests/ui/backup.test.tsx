import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { checksumOf } from '@/features/backup/domain/format';
import { BackupScreen } from '@/features/backup/presentation/screens/BackupScreen';

import { createSeeder } from '../support/seed';

import { createApp, renderWithApp } from './harness';

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 400, height: 800, scale: 2, fontScale: 1 }),
}));

function app() {
  const created = createApp();
  const seed = createSeeder(created.container.db, () => Date.now());
  return { created, seed };
}

const backupFiles = (created: ReturnType<typeof createApp>) =>
  created.deviceFiles.list('documents', 'backups');

/** Makes a backup file as if it had been exported earlier and picked from the device. */
async function pickable(created: ReturnType<typeof createApp>, text: string, name = 'old.json') {
  const file = await created.deviceFiles.writeText('cache', `import/${name}`, text);
  created.deviceFiles.next = { uri: file.uri, name, sizeBytes: file.sizeBytes };
}

describe('BackupScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('starts with no backups and the cloud option shown as not available yet', async () => {
    const { created } = app();
    await renderWithApp(<BackupScreen />, created);
    expect(await screen.findByText('No backups yet')).toBeTruthy();
    expect(screen.getByLabelText('Google Drive. Not available in this version yet')).toBeTruthy();
    expect(screen.getByLabelText('Connect').props.accessibilityState.disabled).toBe(true);
  });

  it('saves a backup on the device and lists it', async () => {
    const { created, seed } = app();
    seed.addTask('Keep me', { createdAt: 5 });
    await renderWithApp(<BackupScreen />, created);
    await fireEvent.press(await screen.findByLabelText('Save backup'));
    expect(await screen.findByText('Backup saved on this device')).toBeTruthy();
    expect(await screen.findByLabelText(/^Manual, /)).toBeTruthy();
    const [file] = await backupFiles(created);
    expect(await created.deviceFiles.readText('documents', file!.path)).toContain('Keep me');
  });

  it('leaves attachments out when asked, and exports a file to share', async () => {
    const { created } = app();
    await renderWithApp(<BackupScreen />, created);
    await screen.findByText('Back up now');
    await fireEvent(screen.getAllByLabelText('Include attachments')[0]!, 'valueChange', false);
    await fireEvent.press(screen.getByLabelText('Export and share'));
    expect(await screen.findByText('Backup exported')).toBeTruthy();
    expect(created.deviceFiles.shared.at(-1)?.mimeType).toBe('application/json');
    await waitFor(() => expect(screen.getByLabelText('Export and share')).toBeTruthy());
  });

  it('says when nothing can open the exported file', async () => {
    const { created } = app();
    created.deviceFiles.canShare = false;
    await renderWithApp(<BackupScreen />, created);
    await fireEvent.press(await screen.findByLabelText('Export and share'));
    expect(
      await screen.findByText('Backup saved, but no app can open it on this device'),
    ).toBeTruthy();
  });

  it('reports a backup that could not be written', async () => {
    const { created } = app();
    jest.spyOn(created.deviceFiles, 'writeText').mockRejectedValue(new Error('disk full'));
    await renderWithApp(<BackupScreen />, created);
    await fireEvent.press(await screen.findByLabelText('Save backup'));
    expect(
      await screen.findByText("Couldn't create the backup. Is there enough free space?"),
    ).toBeTruthy();
  });

  it('deletes a backup and shares one', async () => {
    const { created } = app();
    await created.backup.create('manual', false);
    await renderWithApp(<BackupScreen />, created);
    await fireEvent.press((await screen.findAllByLabelText(/^Share /))[0]!);
    await waitFor(() => expect(created.deviceFiles.shared).toHaveLength(1));
    await fireEvent.press(screen.getAllByLabelText(/^Delete /)[0]!);
    expect(await screen.findByText('Backup deleted')).toBeTruthy();
    expect(await backupFiles(created)).toHaveLength(0);
  });
});

describe('automatic backup settings', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows the defaults and saves changes', async () => {
    const { created } = app();
    await renderWithApp(<BackupScreen />, created);
    expect(await screen.findByLabelText('Back up automatically')).toBeTruthy();
    expect(screen.getByText('No automatic backup yet')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Daily'));
    await fireEvent.press(screen.getByLabelText('Increase Backups to keep'));
    await fireEvent(screen.getAllByLabelText('Include attachments')[1]!, 'valueChange', true);
    await waitFor(() =>
      expect(created.backup.autoSettings()).toEqual({
        enabled: true,
        frequency: 'daily',
        keep: 6,
        includeFiles: true,
      }),
    );

    await fireEvent(screen.getByLabelText('Back up automatically'), 'valueChange', false);
    await waitFor(() => expect(created.backup.autoSettings().enabled).toBe(false));
    expect(screen.queryByLabelText('Daily')).toBeNull();
  });
});

describe('restoring', () => {
  beforeEach(() => jest.clearAllMocks());

  async function twoDevices() {
    const source = app();
    source.seed.addTask('From backup', { createdAt: 5 });
    source.seed.addTask('Shared', { createdAt: 5 });
    const { file } = await source.created.backup.create('manual', false);
    const text = await source.created.deviceFiles.readText('documents', file.path);
    const target = app();
    return { text, target, source };
  }

  it('merges a chosen file after showing what would happen, and shows the result', async () => {
    const { text, target } = await twoDevices();
    target.seed.addTask('Already here', { createdAt: 5 });
    await pickable(target.created, text);
    await renderWithApp(<BackupScreen />, target.created);

    await fireEvent.press(await screen.findByLabelText('Choose backup file'));
    expect(await screen.findByText('old.json')).toBeTruthy();
    expect(await screen.findByText('2 new items will be added')).toBeTruthy();
    expect(screen.getByText('Nothing on this device is deleted when merging.')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Merge backup'));
    expect(await screen.findByText('Backup restored')).toBeTruthy();
    expect(screen.getByText('2 items added')).toBeTruthy();
    expect(
      target.created.container.db.getFirstSync<{ n: number }>('SELECT COUNT(*) AS n FROM tasks')?.n,
    ).toBe(3);
    // A safety copy was made first.
    expect(
      (await backupFiles(target.created)).some((file) =>
        file.name.endsWith('-before-restore.json'),
      ),
    ).toBe(true);
    await fireEvent.press(screen.getByLabelText('Done'));
    await waitFor(() => expect(screen.queryByText('Backup restored')).toBeNull());
  });

  it('asks before replacing everything', async () => {
    const { text, target } = await twoDevices();
    target.seed.addTask('Will be gone', { createdAt: 5 });
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await pickable(target.created, text);
    await renderWithApp(<BackupScreen />, target.created);

    await fireEvent.press(await screen.findByLabelText('Choose backup file'));
    await fireEvent.press(await screen.findByLabelText('Replace everything'));
    expect(screen.getByText(/^Everything on this device will be replaced/)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Replace with backup'));
    expect(alert).toHaveBeenCalledTimes(1);
    // Nothing has changed until the person agrees.
    expect(
      target.created.container.db.getFirstSync<{ n: number }>('SELECT COUNT(*) AS n FROM tasks')?.n,
    ).toBe(1);

    const buttons = alert.mock.calls[0]?.[2] ?? [];
    buttons.find((button) => button.text === 'Replace')?.onPress?.();
    expect(await screen.findByText('Backup restored')).toBeTruthy();
    expect(
      target.created.container.db.getFirstSync<{ n: number }>('SELECT COUNT(*) AS n FROM tasks')?.n,
    ).toBe(2);
  });

  it('lets the conflict policy be chosen and updates the numbers', async () => {
    const { text, target } = await twoDevices();
    target.created.container.db.runSync(
      `INSERT INTO tasks (id, title, created_at, updated_at) SELECT id, 'Local version', 5, 99999999999999 FROM tasks LIMIT 0`,
    );
    await pickable(target.created, text);
    const backupRows = JSON.parse(text).tables.tasks as { id: string }[];
    target.created.container.db.runSync(
      `INSERT INTO tasks (id, title, created_at, updated_at) VALUES (?, 'Local version', 5, 99999999999999)`,
      [backupRows[0]!.id],
    );
    await renderWithApp(<BackupScreen />, target.created);
    await fireEvent.press(await screen.findByLabelText('Choose backup file'));
    expect(await screen.findByText('1 differ, 0 will come from the backup')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Keep the backup'));
    expect(await screen.findByText('1 differ, 1 will come from the backup')).toBeTruthy();
  });

  it('opens a backup kept on the device', async () => {
    const { created } = app();
    await created.backup.create('manual', false);
    await renderWithApp(<BackupScreen />, created);
    await fireEvent.press((await screen.findAllByLabelText(/^Restore /))[0]!);
    expect(await screen.findByText('Restore backup')).toBeTruthy();
  });

  it.each([
    ['not json', 'not a backup', 'This file is not a FocusFlow backup.'],
    [
      'newer',
      JSON.stringify({ format: 'focusflow-backup', version: 99, schemaVersion: 1 }),
      'This backup was made by a newer version of the app. Update FocusFlow to restore it.',
    ],
  ])('explains a file that cannot be used (%s)', async (_name, text, message) => {
    const { created } = app();
    await pickable(created, text);
    await renderWithApp(<BackupScreen />, created);
    await fireEvent.press(await screen.findByLabelText('Choose backup file'));
    expect(await screen.findByText(message)).toBeTruthy();
    expect(screen.queryByText('Restore backup')).toBeNull();
  });

  it('explains a damaged backup', async () => {
    const { created, seed } = app();
    seed.addTask('x', { createdAt: 5 });
    const { file } = await created.backup.create('manual', false);
    const text = (await created.deviceFiles.readText('documents', file.path)).replace(
      '"x"',
      '"hacked"',
    );
    await pickable(created, text);
    await renderWithApp(<BackupScreen />, created);
    await fireEvent.press(await screen.findByLabelText('Choose backup file'));
    expect(
      await screen.findByText(
        'This backup file is damaged or was changed, so it cannot be trusted.',
      ),
    ).toBeTruthy();
  });

  it('does nothing when the file chooser is cancelled', async () => {
    const { created } = app();
    created.deviceFiles.next = null;
    await renderWithApp(<BackupScreen />, created);
    await fireEvent.press(await screen.findByLabelText('Choose backup file'));
    await waitFor(() => expect(screen.getByLabelText('Choose backup file')).toBeTruthy());
    expect(screen.queryByText('Restore backup')).toBeNull();
  });

  async function broken(target: ReturnType<typeof app>, text: string) {
    const bad = JSON.parse(text);
    bad.tables.tasks[0].priority = 99;
    bad.checksum = checksumOf(bad.tables);
    await pickable(target.created, JSON.stringify(bad));
  }
  const taskCount = (created: ReturnType<typeof createApp>) =>
    created.container.db.getFirstSync<{ n: number }>('SELECT COUNT(*) AS n FROM tasks')?.n;

  it('skips the items a merge cannot store and tells you', async () => {
    const { text, target } = await twoDevices();
    await broken(target, text);
    await renderWithApp(<BackupScreen />, target.created);
    await fireEvent.press(await screen.findByLabelText('Choose backup file'));
    await fireEvent.press(await screen.findByLabelText('Merge backup'));
    expect(await screen.findByText('Backup restored')).toBeTruthy();
    expect(
      screen.getByText('1 items were skipped because they clash with existing ones'),
    ).toBeTruthy();
    expect(taskCount(target.created)).toBe(1);
  });

  it('leaves everything as it was when a replace fails', async () => {
    const { text, target } = await twoDevices();
    await broken(target, text);
    target.seed.addTask('Safe', { createdAt: 5 });
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await renderWithApp(<BackupScreen />, target.created);
    await fireEvent.press(await screen.findByLabelText('Choose backup file'));
    await fireEvent.press(await screen.findByLabelText('Replace everything'));
    await fireEvent.press(screen.getByLabelText('Replace with backup'));
    alert.mock.calls[0]?.[2]?.find((button) => button.text === 'Replace')?.onPress?.();
    expect(
      await screen.findByText(/^The backup could not be restored, so nothing was changed\./),
    ).toBeTruthy();
    expect(taskCount(target.created)).toBe(1);
    expect(screen.queryByText('Backup restored')).toBeNull();
  });
});
