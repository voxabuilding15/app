import { useState } from 'react';
import { View } from 'react-native';

import { Chip, FormSection, Input, WRAP_ROW } from '@/components';
import type { Category } from '@/core';

import type { LinkTarget } from '../../domain/entities';
import { MAX_TAGS_PER_SESSION, NOTE_MAX_LENGTH } from '../../domain/session-usecases';

import { LinkPickerSheet } from './LinkPickerSheet';

export interface SessionDetails {
  taskId: string | null;
  habitId: string | null;
  tagIds: string[];
  note: string;
}

interface SessionDetailsFieldsProps {
  title: string;
  details: SessionDetails;
  tasks: readonly LinkTarget[];
  habits: readonly LinkTarget[];
  tags: readonly Category[];
  onChange: (changes: Partial<SessionDetails>) => void;
  /** Called when the note field loses focus, to save it. */
  onNoteBlur?: () => void;
  onManageTags: () => void;
}

/** What a focus session is about: the task, the habit, tags and a note. Shared by the timer and history. */
export function SessionDetailsFields({
  title,
  details,
  tasks,
  habits,
  tags,
  onChange,
  onNoteBlur,
  onManageTags,
}: SessionDetailsFieldsProps) {
  const [picker, setPicker] = useState<'task' | 'habit' | null>(null);
  const task = tasks.find((item) => item.id === details.taskId);
  const habit = habits.find((item) => item.id === details.habitId);

  const toggleTag = (id: string) => {
    const has = details.tagIds.includes(id);
    if (!has && details.tagIds.length >= MAX_TAGS_PER_SESSION) {
      return;
    }
    onChange({
      tagIds: has ? details.tagIds.filter((tag) => tag !== id) : [...details.tagIds, id],
    });
  };

  return (
    <FormSection title={title}>
      <Input
        label="Note"
        value={details.note}
        onChangeText={(note) => onChange({ note })}
        onBlur={onNoteBlur}
        placeholder="What are you working on?"
        multiline
        maxLength={NOTE_MAX_LENGTH}
      />
      <View style={WRAP_ROW}>
        <Chip
          icon="check-circle"
          label={task?.title ?? 'Link a task'}
          accessibilityLabel={task ? `Task: ${task.title}. Change` : 'Link a task'}
          selected={task !== undefined}
          onPress={() => setPicker('task')}
        />
        <Chip
          icon="local-fire-department"
          label={habit?.title ?? 'Link a habit'}
          accessibilityLabel={habit ? `Habit: ${habit.title}. Change` : 'Link a habit'}
          selected={habit !== undefined}
          onPress={() => setPicker('habit')}
        />
      </View>
      <View style={WRAP_ROW}>
        {tags.map((tag) => (
          <Chip
            key={tag.id}
            label={tag.name}
            dotColor={tag.color}
            selected={details.tagIds.includes(tag.id)}
            onPress={() => toggleTag(tag.id)}
          />
        ))}
        <Chip
          icon="sell"
          label={tags.length === 0 ? 'Add tags' : 'Manage tags'}
          onPress={onManageTags}
        />
      </View>
      <LinkPickerSheet
        visible={picker === 'task'}
        title="Link a task"
        noneLabel="No task"
        emptyMessage="You have no open tasks."
        options={tasks}
        selectedId={details.taskId}
        onSelect={(taskId) => onChange({ taskId })}
        onClose={() => setPicker(null)}
      />
      <LinkPickerSheet
        visible={picker === 'habit'}
        title="Link a habit"
        noneLabel="No habit"
        emptyMessage="You have no habits yet."
        options={habits}
        selectedId={details.habitId}
        onSelect={(habitId) => onChange({ habitId })}
        onClose={() => setPicker(null)}
      />
    </FormSection>
  );
}
