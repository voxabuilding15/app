import { View } from 'react-native';

import { spacing } from '@/theme';

import { Card } from './Card';
import { IconButton } from './IconButton';
import { Text } from './Text';
import { useTranslator } from '@/i18n';

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
  const { t } = useTranslator();
  return (
    <Card style={{ paddingVertical: spacing.sm }}>
      {items.map((item) => (
        <View key={item.id} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: item.color }} />
          <Text variant="bodyLarge" style={{ flex: 1 }} numberOfLines={1}>
            {item.name}
          </Text>
          <IconButton
            icon="edit"
            label={t('Edit {name}', { name: item.name })}
            onPress={() => onEdit(item)}
          />
          <IconButton
            icon="delete"
            label={t('Delete {name}', { name: item.name })}
            onPress={() => onDelete(item)}
          />
        </View>
      ))}
    </Card>
  );
}
