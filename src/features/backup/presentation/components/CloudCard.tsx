import { View } from 'react-native';

import { Button, Card, Icon, Text } from '@/components';
import { useTranslator } from '@/i18n';
import { spacing, useTheme } from '@/theme';

import type { BackupViewModel } from '../view-models/useBackupViewModel';

/** Online backup services. Google Drive is prepared in the code but not switched on yet. */
export function CloudCard({ vm }: { vm: BackupViewModel }) {
  const { t } = useTranslator();
  const { colors } = useTheme();

  return (
    <Card style={{ gap: spacing.md }}>
      <Text variant="titleMedium" accessibilityRole="header">
        {t('Cloud backup')}
      </Text>
      {vm.providers.map((provider) => (
        <View
          key={provider.id}
          accessible
          accessibilityLabel={`${provider.name}. ${
            provider.status === 'unavailable' ? t('Not available in this version yet') : t('Ready')
          }`}
          style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}
        >
          <Icon name="cloud-queue" color={colors.onSurfaceVariant} />
          <View style={{ flex: 1 }}>
            <Text>{provider.name}</Text>
            <Text variant="labelSmall" tone="muted">
              {provider.status === 'unavailable'
                ? t('Not available in this version yet')
                : provider.status === 'signed-out'
                  ? t('Sign in to back up online')
                  : t('Ready')}
            </Text>
          </View>
          <Button label={t('Connect')} variant="outlined" disabled onPress={() => undefined} />
        </View>
      ))}
      <Text variant="labelSmall" tone="muted">
        {t('Until then, export a backup file and keep it in the cloud service of your choice.')}
      </Text>
    </Card>
  );
}
