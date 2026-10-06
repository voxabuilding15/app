import { View } from 'react-native';

import { Chip, FormSection, WRAP_ROW } from '@/components';
import { useTranslator } from '@/i18n';

import type { Label } from '../../domain/entities';

interface LabelSectionProps {
  labels: readonly Label[];
  selectedIds: readonly string[];
  onToggle: (id: string) => void;
  onCreate: () => void;
}

export function LabelSection({ labels, selectedIds, onToggle, onCreate }: LabelSectionProps) {
  const { t } = useTranslator();
  return (
    <FormSection title={t('Labels')}>
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
        <Chip
          icon="add"
          label={t('New')}
          accessibilityLabel={t('Create a label')}
          onPress={onCreate}
        />
      </View>
    </FormSection>
  );
}
