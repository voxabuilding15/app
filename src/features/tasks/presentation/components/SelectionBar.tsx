import { View } from 'react-native';

import { IconButton, Text } from '@/components';
import { spacing, useTheme } from '@/theme';

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
      <IconButton icon="close" label="Exit selection" onPress={onClose} />
      <Text
        variant="titleMedium"
        accessibilityLiveRegion="polite"
        style={{ flex: 1, color: colors.onSecondaryContainer }}
      >
        {`${count} selected`}
      </Text>
      <IconButton icon="select-all" label="Select all" onPress={onSelectAll} />
      {scope === 'archived' ? (
        <IconButton
          icon="unarchive"
          label="Restore selected"
          disabled={disabled}
          onPress={onRestore}
        />
      ) : (
        <IconButton
          icon="archive"
          label="Archive selected"
          disabled={disabled}
          onPress={onArchive}
        />
      )}
      <IconButton icon="delete" label="Delete selected" disabled={disabled} onPress={onDelete} />
    </View>
  );
}
