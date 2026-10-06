import { memo } from 'react';
import { Pressable, View } from 'react-native';

import {
  Checkbox,
  Icon,
  ProgressBar,
  SwipeableRow,
  Text,
  describeRecurrence,
  type IconName,
  type SwipeAction,
} from '@/components';
import { radius, spacing, useTheme, type ColorScheme } from '@/theme';
import { useTranslator } from '@/i18n';

import type { Priority, Task } from '../../domain/entities';
import { PRIORITY_LABEL, describeTask, formatDue, isOverdue } from '../format';

const BAR_WIDTH = 4;
const MAX_VISIBLE_LABELS = 2;

function priorityColor(priority: Priority, colors: ColorScheme): string {
  switch (priority) {
    case 'high':
      return colors.error;
    case 'medium':
      return colors.warning;
    default:
      return colors.success;
  }
}

interface MetaProps {
  icon: IconName;
  text: string;
  color: string;
}

function Meta({ icon, text, color }: MetaProps) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
      <Icon name={icon} size={14} color={color} />
      <Text variant="labelSmall" style={{ color }}>
        {text}
      </Text>
    </View>
  );
}

export interface TaskRowProps {
  task: Task;
  /** Current time, supplied by the list so every row agrees on what is overdue. */
  now: number;
  selected: boolean;
  selecting: boolean;
  onPress: (task: Task) => void;
  onLongPress: (task: Task) => void;
  onToggleComplete: (task: Task) => void;
  onArchive: (task: Task) => void;
  onRestore: (task: Task) => void;
  onDelete: (task: Task) => void;
}

function TaskRowComponent({
  task,
  now,
  selected,
  selecting,
  onPress,
  onLongPress,
  onToggleComplete,
  onArchive,
  onRestore,
  onDelete,
}: TaskRowProps) {
  const { t } = useTranslator();
  const { colors } = useTheme();
  const done = task.completedAt !== null;
  const archived = task.archivedAt !== null;
  const overdue = isOverdue(task, now);
  const muted = colors.onSurfaceVariant;

  const deleteAction: SwipeAction = {
    label: t('Delete'),
    icon: 'delete',
    background: colors.error,
    foreground: colors.surface,
    onPress: () => onDelete(task),
  };
  const rightActions: SwipeAction[] = archived
    ? [
        {
          label: t('Restore'),
          icon: 'unarchive',
          background: colors.primary,
          foreground: colors.onPrimary,
          onPress: () => onRestore(task),
        },
        deleteAction,
      ]
    : [
        {
          label: t('Archive'),
          icon: 'archive',
          background: colors.secondaryContainer,
          foreground: colors.onSecondaryContainer,
          onPress: () => onArchive(task),
        },
        deleteAction,
      ];
  const leftActions: SwipeAction[] = archived
    ? []
    : [
        {
          label: done ? t('Reopen') : t('Complete'),
          icon: done ? 'undo' : 'check',
          background: colors.success,
          foreground: colors.surface,
          onPress: () => onToggleComplete(task),
        },
      ];

  const visibleLabels = task.labels.slice(0, MAX_VISIBLE_LABELS);
  const hiddenLabels = task.labels.length - visibleLabels.length;

  return (
    <View style={{ borderRadius: radius.md, overflow: 'hidden' }}>
      <SwipeableRow enabled={!selecting} leftActions={leftActions} rightActions={rightActions}>
        <Pressable
          accessible
          accessibilityRole="button"
          accessibilityLabel={describeTask(task, now)}
          accessibilityState={{ selected, checked: done }}
          accessibilityActions={[
            { name: 'toggle', label: done ? t('Mark as not done') : t('Mark as done') },
            archived
              ? { name: 'restore', label: t('Restore') }
              : { name: 'archive', label: t('Archive') },
            { name: 'delete', label: t('Delete') },
            { name: 'select', label: t('Select') },
          ]}
          onAccessibilityAction={({ nativeEvent }) => {
            switch (nativeEvent.actionName) {
              case 'toggle':
                return onToggleComplete(task);
              case 'archive':
                return onArchive(task);
              case 'restore':
                return onRestore(task);
              case 'delete':
                return onDelete(task);
              default:
                return onLongPress(task);
            }
          }}
          onPress={() => onPress(task)}
          onLongPress={() => onLongPress(task)}
          android_ripple={{ color: colors.outlineVariant }}
          style={{
            flexDirection: 'row',
            alignItems: 'stretch',
            minHeight: 64,
            backgroundColor: selected ? colors.primaryContainer : colors.surfaceContainer,
          }}
        >
          <View
            style={{
              width: BAR_WIDTH,
              backgroundColor:
                done || archived ? colors.outlineVariant : priorityColor(task.priority, colors),
            }}
          />
          <View style={{ justifyContent: 'center', paddingLeft: spacing.xs }}>
            {selecting ? (
              <Checkbox
                checked={selected}
                label={t('Select {title}', { title: task.title })}
                onChange={() => onPress(task)}
              />
            ) : (
              <Checkbox
                checked={done}
                disabled={archived}
                label={
                  done
                    ? t('Mark {title} as not done', { title: task.title })
                    : t('Mark {title} as done', { title: task.title })
                }
                onChange={() => onToggleComplete(task)}
              />
            )}
          </View>
          <View
            style={{
              flex: 1,
              gap: spacing.xs,
              paddingVertical: spacing.md,
              paddingRight: spacing.lg,
            }}
          >
            <Text
              variant="bodyLarge"
              numberOfLines={2}
              style={done ? { textDecorationLine: 'line-through', color: muted } : undefined}
            >
              {task.title}
            </Text>
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                alignItems: 'center',
                columnGap: spacing.md,
                rowGap: spacing.xs,
              }}
            >
              {task.due ? (
                <Meta
                  icon={overdue ? 'error-outline' : 'event'}
                  text={formatDue(task.due, now)}
                  color={overdue ? colors.error : muted}
                />
              ) : null}
              {task.repeat ? (
                <Meta icon="repeat" text={describeRecurrence(task.repeat)} color={muted} />
              ) : null}
              {task.reminderOffsetMinutes !== null ? (
                <Meta
                  icon={task.isAlarm ? 'alarm' : 'notifications-none'}
                  text={task.isAlarm ? t('Alarm') : t('Reminder')}
                  color={muted}
                />
              ) : null}
              {task.priority !== 'medium' ? (
                <Meta
                  icon="flag"
                  text={PRIORITY_LABEL[task.priority]}
                  color={task.priority === 'high' ? colors.error : colors.success}
                />
              ) : null}
              {task.category ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: task.category.color,
                    }}
                  />
                  <Text variant="labelSmall" tone="muted">
                    {task.category.name}
                  </Text>
                </View>
              ) : null}
              {visibleLabels.map((label) => (
                <View
                  key={label.id}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}
                >
                  <Icon name="label" size={14} color={label.color} />
                  <Text variant="labelSmall" tone="muted">
                    {label.name}
                  </Text>
                </View>
              ))}
              {hiddenLabels > 0 ? (
                <Text variant="labelSmall" tone="muted">{`+${hiddenLabels}`}</Text>
              ) : null}
            </View>
            {task.subtaskTotal > 0 ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <View style={{ flex: 1 }}>
                  <ProgressBar
                    height={4}
                    progress={task.subtaskDone / task.subtaskTotal}
                    label={t('{subtaskDone} of {subtaskTotal} subtasks done', {
                      subtaskDone: task.subtaskDone,
                      subtaskTotal: task.subtaskTotal,
                    })}
                  />
                </View>
                <Text
                  variant="labelSmall"
                  tone="muted"
                >{`${task.subtaskDone}/${task.subtaskTotal}`}</Text>
              </View>
            ) : null}
          </View>
        </Pressable>
      </SwipeableRow>
    </View>
  );
}

export const TaskRow = memo(TaskRowComponent);
