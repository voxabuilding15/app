import { Stack } from 'expo-router';
import { View } from 'react-native';

import { Button, Card, Screen, Snackbar, SwitchRow, Text } from '@/components';
import { useTranslator } from '@/i18n';
import { spacing } from '@/theme';

import { AutoBackupCard } from '../components/AutoBackupCard';
import { CloudCard } from '../components/CloudCard';
import { RestoreSheet } from '../components/RestoreSheet';
import { StoredBackups } from '../components/StoredBackups';
import { useBackupViewModel } from '../view-models/useBackupViewModel';

/** Back up, export, import and restore. */
export function BackupScreen() {
  const vm = useBackupViewModel();
  const { t } = useTranslator();
  const { result } = vm;

  return (
    <>
      <Stack.Screen options={{ title: t('Backup and restore') }} />
      <Screen>
        {result === null ? null : (
          <Card style={{ gap: spacing.sm }}>
            <View accessibilityLiveRegion="polite" style={{ gap: spacing.xs }}>
              <Text variant="titleMedium" tone="success" accessibilityRole="header">
                {t('Backup restored')}
              </Text>
              <Text>{t('{count} items added', { count: result.inserted })}</Text>
              {result.updated > 0 ? (
                <Text>{t('{count} items updated', { count: result.updated })}</Text>
              ) : null}
              {result.skipped > 0 ? (
                <Text tone="muted">
                  {t('{count} items were skipped because they clash with existing ones', {
                    count: result.skipped,
                  })}
                </Text>
              ) : null}
              {result.repaired > 0 ? (
                <Text tone="muted">
                  {t('{count} links to skipped items were cleaned up', { count: result.repaired })}
                </Text>
              ) : null}
              <Text variant="labelSmall" tone="muted">
                {t(
                  'Reminders are set again when you next save each item. A copy of your previous data is under “Before a restore”.',
                )}
              </Text>
            </View>
            <Button label={t('Done')} variant="text" onPress={vm.dismissResult} />
          </Card>
        )}

        <Card style={{ gap: spacing.md }}>
          <Text variant="titleMedium" accessibilityRole="header">
            {t('Back up now')}
          </Text>
          <Text tone="muted">
            {t('Everything stays on this device unless you share the file yourself.')}
          </Text>
          <SwitchRow
            title={t('Include attachments')}
            subtitle={t('Photos, PDFs and recordings (files over 10 MB are left out)')}
            value={vm.includeFiles}
            onChange={vm.setIncludeFiles}
          />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
            <Button
              label={t('Save backup')}
              icon="save"
              loading={vm.busy === 'save'}
              onPress={() => void vm.saveNow()}
            />
            <Button
              label={t('Export and share')}
              icon="ios-share"
              variant="tonal"
              loading={vm.busy === 'export'}
              onPress={() => void vm.exportFile()}
            />
          </View>
        </Card>

        <Card style={{ gap: spacing.md }}>
          <Text variant="titleMedium" accessibilityRole="header">
            {t('Restore from a file')}
          </Text>
          <Text tone="muted">
            {t(
              'Choose a backup file you exported earlier. You decide whether to replace or merge before anything changes.',
            )}
          </Text>
          <Button
            label={t('Choose backup file')}
            icon="folder-open"
            variant="tonal"
            loading={vm.busy === 'import'}
            onPress={() => void vm.importFile()}
          />
        </Card>

        <AutoBackupCard vm={vm} />
        <StoredBackups vm={vm} />
        <CloudCard vm={vm} />
      </Screen>
      <RestoreSheet vm={vm} />
      {vm.notice ? <Snackbar message={vm.notice.message} onDismiss={vm.dismissNotice} /> : null}
    </>
  );
}
