import { memo } from 'react';
import { Pressable, View } from 'react-native';

import { Icon, SwipeableRow, Text, type IconName, type SwipeAction } from '@/components';
import { radius, spacing, useTheme, withAlpha } from '@/theme';
import { useTranslator } from '@/i18n';

import type { NoteSummary } from '../../domain/entities';
import type { NoteScope } from '../../domain/filters';
import { describeNote, displayTitle, formatReminder } from '../format';

interface NoteCardHandlers {
  onPress: (note: NoteSummary) => void;
  onPin: (note: NoteSummary) => void;
  onFavorite: (note: NoteSummary) => void;
  onArchive: (note: NoteSummary) => void;
  onUnarchive: (note: NoteSummary) => void;
  onTrash: (note: NoteSummary) => void;
  onRestore: (note: NoteSummary) => void;
  onDeleteForever: (note: NoteSummary) => void;
}

interface NoteCardProps extends NoteCardHandlers {
  note: NoteSummary;
  now: number;
  scope: NoteScope;
}

function Meta({ icon, text, color }: { icon: IconName; text?: string; color: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
      <Icon name={icon} size={14} color={color} />
      {text ? (
        <Text variant="labelSmall" style={{ color }}>
          {text}
        </Text>
      ) : null}
    </View>
  );
}

function NoteCardComponent({ note, now, scope, ...handlers }: NoteCardProps) {
  const { t } = useTranslator();
  const { colors } = useTheme();
  const accent = note.color ?? colors.outlineVariant;
  const muted = colors.onSurfaceVariant;

  const action = (
    label: string,
    icon: IconName,
    background: string,
    foreground: string,
    run: (note: NoteSummary) => void,
  ): SwipeAction => ({ label, icon, background, foreground, onPress: () => run(note) });

  const danger = (label: string, icon: IconName, run: (note: NoteSummary) => void) =>
    action(label, icon, colors.error, colors.surface, run);
  const neutral = (label: string, icon: IconName, run: (note: NoteSummary) => void) =>
    action(label, icon, colors.secondaryContainer, colors.onSecondaryContainer, run);

  let left: SwipeAction[];
  let right: SwipeAction[];
  if (scope === 'trash') {
    left = [
      action(
        t('Restore'),
        'restore-from-trash',
        colors.primary,
        colors.onPrimary,
        handlers.onRestore,
      ),
    ];
    right = [danger(t('Delete forever'), 'delete-forever', handlers.onDeleteForever)];
  } else if (scope === 'archived') {
    left = [
      action(t('Unarchive'), 'unarchive', colors.primary, colors.onPrimary, handlers.onUnarchive),
    ];
    right = [danger(t('Delete'), 'delete', handlers.onTrash)];
  } else {
    left = [
      neutral(
        note.pinned ? t('Unpin') : t('Pin'),
        note.pinned ? 'push-pin' : 'push-pin',
        handlers.onPin,
      ),
      neutral(
        note.favorite ? t('Unfavorite') : t('Favorite'),
        note.favorite ? 'star' : 'star-border',
        handlers.onFavorite,
      ),
    ];
    right = [
      neutral(t('Archive'), 'archive', handlers.onArchive),
      danger(t('Delete'), 'delete', handlers.onTrash),
    ];
  }
  const accessibilityActions = [...left, ...right].map((swipe) => ({
    name: swipe.label,
    label: swipe.label,
    run: swipe.onPress,
  }));

  return (
    <View style={{ borderRadius: radius.lg, overflow: 'hidden' }}>
      <SwipeableRow leftActions={left} rightActions={right}>
        <Pressable
          accessible
          accessibilityRole="button"
          accessibilityLabel={describeNote(note, now)}
          accessibilityActions={accessibilityActions.map(({ name, label }) => ({ name, label }))}
          onAccessibilityAction={({ nativeEvent }) =>
            accessibilityActions.find((entry) => entry.name === nativeEvent.actionName)?.run()
          }
          onPress={() => handlers.onPress(note)}
          android_ripple={{ color: colors.outlineVariant }}
          style={{
            flexDirection: 'row',
            backgroundColor: note.color ? withAlpha(note.color, 0.16) : colors.surfaceContainer,
          }}
        >
          <View style={{ width: 6, backgroundColor: accent }} />
          <View style={{ flex: 1, gap: spacing.xs, padding: spacing.lg }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Text variant="titleMedium" numberOfLines={1} style={{ flex: 1 }}>
                {displayTitle(note.title)}
              </Text>
              {note.pinned ? <Icon name="push-pin" size={16} color={colors.primary} /> : null}
              {note.favorite ? <Icon name="star" size={16} color={colors.warning} /> : null}
              {note.locked ? <Icon name="lock" size={16} color={muted} /> : null}
            </View>
            {note.locked ? (
              <Text variant="bodyMedium" tone="muted">
                {t('Locked note')}
              </Text>
            ) : note.preview ? (
              <Text variant="bodyMedium" tone="muted" numberOfLines={3}>
                {note.preview}
              </Text>
            ) : null}
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                alignItems: 'center',
                columnGap: spacing.md,
                rowGap: spacing.xs,
              }}
            >
              {note.folder ? <Meta icon="folder" text={note.folder.name} color={muted} /> : null}
              {note.checklistTotal > 0 ? (
                <Meta
                  icon="checklist"
                  text={`${note.checklistDone}/${note.checklistTotal}`}
                  color={muted}
                />
              ) : null}
              {note.attachmentCount > 0 ? (
                <Meta icon="attach-file" text={String(note.attachmentCount)} color={muted} />
              ) : null}
              {note.reminderAt !== null ? (
                <Meta
                  icon="notifications-none"
                  text={formatReminder(note.reminderAt, now)}
                  color={muted}
                />
              ) : null}
              {note.tags.map((tag) => (
                <View
                  key={tag.id}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}
                >
                  <View
                    style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: tag.color }}
                  />
                  <Text variant="labelSmall" tone="muted">
                    {tag.name}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </Pressable>
      </SwipeableRow>
    </View>
  );
}

export const NoteCard = memo(NoteCardComponent);
