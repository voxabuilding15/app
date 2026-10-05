import { View } from 'react-native';

import { spacing } from '@/theme';

import { Card } from './Card';
import { IconButton } from './IconButton';
import { Text } from './Text';

interface NamedItem {
  id: string;
  name: string;
  color: string;
}

interface NamedItemListProps {
  items: readonly NamedItem[];
  onEdit: (item: NamedItem) => void;
  onDelete: (item: NamedItem) => void;
}

/** Editable list of colored, named items (categories, labels). */
export function NamedItemList({ items, onEdit, onDelete }: NamedItemListProps) {
  return (
    <Card style={{ paddingVertical: spacing.sm }}>
      {items.map((item) => (
        <View key={item.id} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: item.color }} />
          <Text variant="bodyLarge" style={{ flex: 1 }} numberOfLines={1}>
            {item.name}
          </Text>
          <IconButton icon="edit" label={`Edit ${item.name}`} onPress={() => onEdit(item)} />
          <IconButton icon="delete" label={`Delete ${item.name}`} onPress={() => onDelete(item)} />
        </View>
      ))}
    </Card>
  );
}
