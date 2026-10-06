import { useState } from 'react';
import { View } from 'react-native';

import { Checkbox, FormSection, IconButton, Input } from '@/components';
import { spacing } from '@/theme';
import { useTranslator } from '@/i18n';

import type { SubtaskDraft } from '../../domain/validation';

interface SubtasksSectionProps {
  subtasks: readonly SubtaskDraft[];
  error?: string;
  onAdd: (title: string) => void;
  onRename: (index: number, title: string) => void;
  onToggle: (index: number) => void;
  onRemove: (index: number) => void;
}

export function SubtasksSection({
  subtasks,
  error,
  onAdd,
  onRename,
  onToggle,
  onRemove,
}: SubtasksSectionProps) {
  const { t } = useTranslator();
  const [draft, setDraft] = useState('');

  const add = () => {
    onAdd(draft);
    setDraft('');
  };

  return (
    <FormSection title={t('Subtasks')} error={error}>
      {subtasks.map((subtask, index) => (
        <View
          key={subtask.id ?? `new-${index}`}
          style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}
        >
          <Checkbox
            checked={subtask.completed}
            label={t('Subtask {value} done', { value: index + 1 })}
            onChange={() => onToggle(index)}
          />
          <View style={{ flex: 1 }}>
            <Input
              label={t('Subtask {value}', { value: index + 1 })}
              labelHidden
              value={subtask.title}
              onChangeText={(title) => onRename(index, title)}
            />
          </View>
          <IconButton
            icon="close"
            label={t('Remove subtask {value}', { value: index + 1 })}
            onPress={() => onRemove(index)}
          />
        </View>
      ))}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
        <View style={{ flex: 1 }}>
          <Input
            label={t('Add subtask')}
            labelHidden
            placeholder={t('Add a subtask')}
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={add}
            returnKeyType="done"
            blurOnSubmit={false}
          />
        </View>
        <IconButton
          icon="add"
          label={t('Add subtask')}
          tinted
          disabled={draft.trim() === ''}
          onPress={add}
        />
      </View>
    </FormSection>
  );
}
