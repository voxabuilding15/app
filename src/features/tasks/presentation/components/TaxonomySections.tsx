import { View } from 'react-native';

import { Chip } from '@/components';

import type { Category, Label } from '../../domain/entities';

import { FormSection, WRAP_ROW } from './FormSection';

interface CategorySectionProps {
  categories: readonly Category[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onCreate: () => void;
}

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

interface LabelSectionProps {
  labels: readonly Label[];
  selectedIds: readonly string[];
  onToggle: (id: string) => void;
  onCreate: () => void;
}

export function LabelSection({ labels, selectedIds, onToggle, onCreate }: LabelSectionProps) {
  return (
    <FormSection title="Labels">
      <View style={WRAP_ROW}>
        {labels.map((label) => (
          <Chip
            key={label.id}
            label={label.name}
            dotColor={label.color}
            selected={selectedIds.includes(label.id)}
            onPress={() => onToggle(label.id)}
          />
        ))}
        <Chip icon="add" label="New" accessibilityLabel="Create a label" onPress={onCreate} />
      </View>
    </FormSection>
  );
}
