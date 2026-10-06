import { ScrollView } from 'react-native';

import { ListItem, Sheet, Text } from '@/components';
import { spacing } from '@/theme';

import type { LinkTarget } from '../../domain/entities';

interface LinkPickerSheetProps {
  visible: boolean;
  title: string;
  noneLabel: string;
  emptyMessage: string;
  options: readonly LinkTarget[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onClose: () => void;
}

/** Pick one task or habit to link a session to, or none. */
export function LinkPickerSheet({
  visible,
  title,
  noneLabel,
  emptyMessage,
  options,
  selectedId,
  onSelect,
  onClose,
}: LinkPickerSheetProps) {
  const choose = (id: string | null) => {
    onSelect(id);
    onClose();
  };

  return (
    <Sheet visible={visible} title={title} onClose={onClose}>
      <ScrollView style={{ maxHeight: 360 }} contentContainerStyle={{ gap: spacing.xs }}>
        <ListItem
          title={noneLabel}
          icon={selectedId === null ? 'radio-button-checked' : 'radio-button-unchecked'}
          onPress={() => choose(null)}
        />
        {options.map((option) => (
          <ListItem
            key={option.id}
            title={option.title}
            icon={selectedId === option.id ? 'radio-button-checked' : 'radio-button-unchecked'}
            onPress={() => choose(option.id)}
          />
        ))}
        {options.length === 0 ? (
          <Text variant="bodyMedium" tone="muted">
            {emptyMessage}
          </Text>
        ) : null}
      </ScrollView>
    </Sheet>
  );
}
