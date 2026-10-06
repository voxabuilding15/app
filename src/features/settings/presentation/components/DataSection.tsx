import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Alert } from 'react-native';

import { Button, Divider, ListItem, Snackbar } from '@/components';
import { useNotice } from '@/hooks';
import { useTranslator } from '@/i18n';

import { useBackupModule } from '../../../backup/presentation/module';
import { useUsage } from '../queries';

import { SettingsSection } from './SettingsSection';

function formatBytes(bytes: number): string {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DataSection() {
  const { t } = useTranslator();
  const router = useRouter();
  const client = useQueryClient();
  const { backups } = useBackupModule();
  const { data } = useUsage();
  const { notice, show, dismiss } = useNotice();

  const erase = async (keepSafetyCopy: boolean) => {
    try {
      await backups.eraseEverything({ keepSafetyCopy });
      await client.invalidateQueries();
      show({
        message: keepSafetyCopy
          ? t('All data deleted. A safety copy was kept in your backups.')
          : t('All data deleted.'),
      });
    } catch {
      show({ message: t("Couldn't delete your data. Nothing was changed.") });
    }
  };

  const confirmErase = () =>
    Alert.alert(
      t('Delete all data?'),
      t(
        'Every task, habit, event, transaction, note and setting on this device will be deleted. This cannot be undone unless you keep a safety copy.',
      ),
      [
        { text: t('Cancel'), style: 'cancel' },
        { text: t('Delete, keep a safety copy'), onPress: () => void erase(true) },
        { text: t('Delete everything'), style: 'destructive', onPress: () => void erase(false) },
      ],
    );

  const items =
    data === undefined
      ? []
      : ([
          [t('Tasks'), data.tasks],
          [t('Habits'), data.habits],
          [t('Events'), data.events],
          [t('Transactions'), data.transactions],
          [t('Notes'), data.notes],
          [t('Focus sessions'), data.focusSessions],
        ] as const);

  return (
    <SettingsSection title={t('Data')}>
      <ListItem
        title={t('Backup and restore')}
        subtitle={t('Export, import and automatic backups')}
        icon="backup"
        onPress={() => router.push('/settings/backup')}
      />
      <Divider />
      {data === undefined ? null : (
        <ListItem
          title={t('Storage used')}
          subtitle={`${items.map(([label, count]) => `${label} ${count}`).join(' · ')} · ${formatBytes(data.databaseBytes)}`}
          icon="storage"
        />
      )}
      <Button
        label={t('Delete all data')}
        icon="delete-forever"
        variant="outlined"
        onPress={confirmErase}
      />
      {notice ? <Snackbar message={notice.message} onDismiss={dismiss} /> : null}
    </SettingsSection>
  );
}
