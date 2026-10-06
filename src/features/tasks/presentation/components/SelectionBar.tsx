import { View } from 'react-native';

import { IconButton, Text } from '@/components';
import { spacing, useTheme } from '@/theme';
import { useTranslator } from '@/i18n';

import type { TaskScope } from '../../domain/filters';

interface SelectionBarProps {
  count: number;
  scope: TaskScope;
  onClose: () => void;
  onSelectAll: () => void;
  onArchive: () => void;
  onRestore: () => void;
  onDelete: () => void;
}

export function SelectionBar({
  count,
  scope,
  onClose,
  onSelectAll,
  onArchive,
  onRestore,
  onDelete,
}: SelectionBarProps) {
  const { t } = useTranslator();
  const { colors } = useTheme();
  const disabled = count === 0;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.sm,
        backgroundColor: colors.secondaryContainer,
      }}
    >
      <IconButton icon="close" label={t('Exit selection')} onPress={onClose} />
      <Text
        variant="titleMedium"
        accessibilityLiveRegion="polite"
        style={{ flex: 1, color: colors.onSecondaryContainer }}
      >
        {t('{count} selected', { count })}
      </Text>
      <IconButton icon="select-all" label={t('Select all')} onPress={onSelectAll} />
      {scope === 'archived' ? (
        <IconButton
          icon="unarchive"
          label={t('Restore selected')}
          disabled={disabled}
          onPress={onRestore}
        />
      ) : (
        <IconButton
          icon="archive"
          label={t('Archive selected')}
          disabled={disabled}
          onPress={onArchive}
        />
      )}
      <IconButton
        icon="delete"
        label={t('Delete selected')}
        disabled={disabled}
        onPress={onDelete}
      />
    </View>
  );
}
