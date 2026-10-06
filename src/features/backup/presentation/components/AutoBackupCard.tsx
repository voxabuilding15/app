import { View } from 'react-native';

import { Card, NumberStepper, SegmentedControl, SwitchRow, Text } from '@/components';
import { useTranslator } from '@/i18n';
import { spacing } from '@/theme';

import { KEEP_RANGE, type BackupFrequency } from '../../domain/settings';
import { formatWhen } from '../format';
import type { BackupViewModel } from '../view-models/useBackupViewModel';

export function AutoBackupCard({ vm }: { vm: BackupViewModel }) {
  const { t, locale } = useTranslator();
  const { auto } = vm;
  const frequencies: readonly { value: BackupFrequency; label: string }[] = [
    { value: 'daily', label: t('Daily') },
    { value: 'weekly', label: t('Weekly') },
  ];

  return (
    <Card style={{ gap: spacing.md }}>
      <Text variant="titleMedium" accessibilityRole="header">
        {t('Automatic backups')}
      </Text>
      <SwitchRow
        title={t('Back up automatically')}
        subtitle={t('Made when the app opens and a backup is due. Kept on this device only.')}
        value={auto.enabled}
        onChange={(enabled) => vm.changeAuto({ enabled })}
      />
      {auto.enabled ? (
        <View style={{ gap: spacing.md }}>
          <SegmentedControl
            options={frequencies}
            value={auto.frequency}
            onChange={(frequency) => vm.changeAuto({ frequency })}
          />
          <View
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <Text>{t('Backups to keep')}</Text>
            <NumberStepper
              value={auto.keep}
              min={KEEP_RANGE.min}
              max={KEEP_RANGE.max}
              label={t('Backups to keep')}
              onChange={(keep) => vm.changeAuto({ keep })}
            />
          </View>
          <SwitchRow
            title={t('Include attachments')}
            subtitle={t('Photos, PDFs and recordings make backups much larger')}
            value={auto.includeFiles}
            onChange={(includeFiles) => vm.changeAuto({ includeFiles })}
          />
          <Text variant="labelSmall" tone="muted">
            {vm.lastAutoAt === null
              ? t('No automatic backup yet')
              : t('Last automatic backup: {when}', { when: formatWhen(vm.lastAutoAt, locale) })}
          </Text>
        </View>
      ) : null}
    </Card>
  );
}
