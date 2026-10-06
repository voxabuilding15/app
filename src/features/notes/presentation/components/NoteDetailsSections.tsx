import { View } from 'react-native';

import { Chip, ColorSwatches, FormSection, Text, WRAP_ROW } from '@/components';
import type { Category } from '@/core';
import { spacing } from '@/theme';
import { useTranslator } from '@/i18n';

interface ColorSectionProps {
  color: string | null;
  error?: string;
  onChange: (color: string | null) => void;
}

/** Pick a color for a note, or none. */
export function ColorSection({ color, error, onChange }: ColorSectionProps) {
  const { t } = useTranslator();
  return (
    <FormSection title={t('Color')} error={error}>
      <View style={WRAP_ROW}>
        <Chip label={t('No color')} selected={color === null} onPress={() => onChange(null)} />
      </View>
      <ColorSwatches value={color ?? ''} onChange={onChange} />
    </FormSection>
  );
}

interface TagsSectionProps {
  tags: readonly Category[];
  selectedIds: readonly string[];
  onToggle: (id: string) => void;
  onCreate: () => void;
}

/** Pick any number of tags, or create a new one. */
export function TagsSection({ tags, selectedIds, onToggle, onCreate }: TagsSectionProps) {
  const { t } = useTranslator();
  return (
    <FormSection title={t('Tags')}>
      <View style={WRAP_ROW}>
        {tags.map((tag) => (
          <Chip
            key={tag.id}
            label={tag.name}
            dotColor={tag.color}
            selected={selectedIds.includes(tag.id)}
            onPress={() => onToggle(tag.id)}
          />
        ))}
        <Chip
          icon="add"
          label={t('New')}
          accessibilityLabel={t('Create a tag')}
          onPress={onCreate}
        />
      </View>
      {tags.length === 0 ? (
        <View style={{ paddingHorizontal: spacing.xs }}>
          <Text variant="labelSmall" tone="muted">
            {t('Tags group notes across folders, like Ideas or Recipes.')}
          </Text>
        </View>
      ) : null}
    </FormSection>
  );
}
