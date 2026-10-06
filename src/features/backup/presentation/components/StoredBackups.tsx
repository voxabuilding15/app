import { View } from 'react-native';

import { Card, Chip, Divider, EmptyState, IconButton, Text } from '@/components';
import { useTranslator } from '@/i18n';
import { spacing } from '@/theme';

import type { BackupKind } from '../../domain/names';
import { formatSize, formatWhen } from '../format';
import type { BackupViewModel } from '../view-models/useBackupViewModel';

/** Backups kept on this device, each with restore, share and delete. */
export function StoredBackups({ vm }: { vm: BackupViewModel }) {
  const { t, locale } = useTranslator();
  const kindLabel: Record<BackupKind, string> = {
    manual: t('Manual'),
    auto: t('Automatic'),
    safety: t('Safety copy'),
  };

  return (
    <Card style={{ gap: spacing.md }}>
      <Text variant="titleMedium" accessibilityRole="header">
        {t('Backups on this device')}
      </Text>
      {vm.backups.length === 0 && !vm.isLoading ? (
        <EmptyState
          icon="backup"
          title={t('No backups yet')}
          message={t('Create one above, or let automatic backups do it for you.')}
        />
      ) : (
        vm.backups.map((entry, index) => (
          <View key={entry.file.path} style={{ gap: spacing.sm }}>
            {index > 0 ? <Divider /> : null}
            <View
              accessible
              accessibilityLabel={`${kindLabel[entry.kind]}, ${formatWhen(entry.file.modifiedAt, locale)}, ${formatSize(entry.file.sizeBytes)}`}
              style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}
            >
              <View style={{ flex: 1, gap: spacing.xs }}>
                <Text>{formatWhen(entry.file.modifiedAt, locale)}</Text>
                <Text variant="labelSmall" tone="muted">
                  {formatSize(entry.file.sizeBytes)}
                </Text>
              </View>
              <Chip label={kindLabel[entry.kind]} />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
              <IconButton
                icon="restore"
                label={t('Restore {name}', { name: formatWhen(entry.file.modifiedAt, locale) })}
                onPress={() => void vm.openStored(entry.file)}
              />
              <IconButton
                icon="share"
                label={t('Share {name}', { name: formatWhen(entry.file.modifiedAt, locale) })}
                onPress={() => void vm.shareStored(entry.file)}
              />
              <IconButton
                icon="delete-outline"
                label={t('Delete {name}', { name: formatWhen(entry.file.modifiedAt, locale) })}
                onPress={() => void vm.deleteStored(entry)}
              />
            </View>
          </View>
        ))
      )}
    </Card>
  );
}
