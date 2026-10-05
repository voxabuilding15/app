import type { Category } from '@/core';

import { Chip } from './Chip';
import { WRAP_ROW } from './ChipGroup';
import { FormSection } from './FormSection';
import { View } from 'react-native';

interface CategorySectionProps {
  categories: readonly Category[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onCreate: () => void;
}

/** Form section to pick one category, or create a new one inline. */
export function CategorySection({
  categories,
  selectedId,
  onSelect,
  onCreate,
}: CategorySectionProps) {
  return (
    <FormSection title="Category">
      <View style={WRAP_ROW}>
        <Chip label="None" selected={selectedId === null} onPress={() => onSelect(null)} />
        {categories.map((category) => (
          <Chip
            key={category.id}
            label={category.name}
            dotColor={category.color}
            selected={selectedId === category.id}
            onPress={() => onSelect(category.id)}
          />
        ))}
        <Chip icon="add" label="New" accessibilityLabel="Create a category" onPress={onCreate} />
      </View>
    </FormSection>
  );
}
