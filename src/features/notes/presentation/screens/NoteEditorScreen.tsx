import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, View, useWindowDimensions } from 'react-native';

import {
  Button,
  Chip,
  DateTimeSection,
  EmptyState,
  FormSection,
  IconButton,
  Input,
  NameColorSheet,
  Screen,
  SegmentedControl,
  SwitchRow,
  Text,
  WRAP_ROW,
  LockGate,
} from '@/components';
import { useHideTabBar } from '@/hooks';
import { ACCENT_COLORS, spacing, useTheme } from '@/theme';

import type { NoteDetail } from '../../domain/entities';
import { folderPath, flattenFolderTree } from '../../domain/folders';
import { BODY_MAX_LENGTH, TITLE_MAX_LENGTH, type NoteDraft } from '../../domain/validation';
import { AttachmentsSection, ImageViewer } from '../components/AttachmentsSection';
import { DrawingModal } from '../components/DrawingModal';
import { FolderPickerSheet } from '../components/FolderPickerSheet';
import { FormatToolbar } from '../components/FormatToolbar';
import { MarkdownView } from '../components/MarkdownView';
import { ColorSection, TagsSection } from '../components/NoteDetailsSections';
import { RecorderSheet } from '../components/RecorderSheet';
import { formatDay, formatTime } from '../format';
import { useFolderTree } from '../queries';
import { useLock } from '../view-models/useLock';
import {
  useNoteEditorViewModel,
  useNoteLoader,
  type NewNoteDefaults,
} from '../view-models/useNoteEditorViewModel';

const WIDE_MIN_WIDTH = 900;
const WIDE_MAX_WIDTH = 1200;
const BODY_MIN_HEIGHT = 280;

const MODES = [
  { value: 'edit', label: 'Edit' },
  { value: 'preview', label: 'Preview' },
] as const;

interface NoteEditorScreenProps {
  /** Null creates a new note. */
  noteId: string | null;
  defaults: NewNoteDefaults;
}

export function NoteEditorScreen({ noteId, defaults }: NoteEditorScreenProps) {
  useHideTabBar();
  const { colors } = useTheme();
  const lock = useLock();
  const load = useNoteLoader(noteId, defaults);
  const title = noteId === null ? 'New note' : 'Edit note';

  if (load.phase === 'ready') {
    const gated = load.note?.locked === true && lock.method !== 'none' && !lock.unlocked;
    if (gated) {
      return (
        <>
          <Stack.Screen options={{ title: 'Locked note' }} />
          <Screen>
            <LockGate
              method={lock.method as 'device' | 'pin'}
              unlock={lock.unlock}
              subject="This note"
            />
          </Screen>
        </>
      );
    }
    return <NoteEditorBody noteId={noteId} initial={load.initial} note={load.note} />;
  }

  return (
    <>
      <Stack.Screen options={{ title }} />
      {load.phase === 'loading' ? (
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.background,
          }}
        >
          <ActivityIndicator
            size="large"
            color={colors.primary}
            accessibilityLabel="Loading note"
          />
        </View>
      ) : (
        <Screen>
          <EmptyState
            icon="error-outline"
            title={load.phase === 'notFound' ? 'Note not found' : "Couldn't load the note"}
            message={
              load.phase === 'notFound'
                ? 'This note may have been deleted.'
                : 'Your notes are safe on this device. Try again.'
            }
            actionLabel={load.phase === 'failed' ? 'Try again' : undefined}
            onAction={load.phase === 'failed' ? load.retry : undefined}
          />
        </Screen>
      )}
    </>
  );
}

interface NoteEditorBodyProps {
  noteId: string | null;
  initial: NoteDraft;
  note: NoteDetail | null;
}

function NoteEditorBody({ noteId, initial, note }: NoteEditorBodyProps) {
  const { width } = useWindowDimensions();
  const router = useRouter();
  const vm = useNoteEditorViewModel(noteId, initial);
  const tree = useFolderTree();
  const [pickingFolder, setPickingFolder] = useState(false);
  const [creatingTag, setCreatingTag] = useState(false);
  const wide = width >= WIDE_MIN_WIDTH;
  const { draft, errors } = vm;

  const folders = flattenFolderTree(tree.data ?? []);
  const folderLabel = draft.folderId === null ? 'No folder' : folderPath(folders, draft.folderId);
  const inactive = note?.deletedAt != null || note?.archivedAt != null;

  const toggleLock = (locked: boolean) => {
    if (!vm.setLocked(locked)) {
      Alert.alert(
        'Set up a lock first',
        'Choose a PIN or use your phone’s screen lock to protect notes.',
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'Set up lock', onPress: () => router.push('/notes/lock') },
        ],
      );
    }
  };

  const header = (
    <Stack.Screen
      options={{
        title: vm.isEditing ? 'Edit note' : 'New note',
        headerRight: () => (
          <View style={{ flexDirection: 'row' }}>
            <IconButton
              icon="push-pin"
              label={draft.pinned ? 'Unpin note' : 'Pin note'}
              tinted={draft.pinned}
              onPress={() => vm.setPinned(!draft.pinned)}
            />
            <IconButton
              icon={draft.favorite ? 'star' : 'star-border'}
              label={draft.favorite ? 'Remove from favorites' : 'Add to favorites'}
              tinted={draft.favorite}
              onPress={() => vm.setFavorite(!draft.favorite)}
            />
          </View>
        ),
      }}
    />
  );

  const writing = (
    <>
      <Input
        label="Title"
        value={draft.title}
        onChangeText={vm.setTitle}
        error={errors.title}
        maxLength={TITLE_MAX_LENGTH}
        autoFocus={!vm.isEditing}
        returnKeyType="next"
      />
      <SegmentedControl options={MODES} value={vm.mode} onChange={vm.setMode} />
      {vm.mode === 'edit' ? (
        <>
          <FormatToolbar onInline={vm.formatInline} onBlock={vm.formatBlock} />
          <Input
            label="Note text"
            labelHidden
            value={draft.body}
            onChangeText={vm.setBody}
            selection={vm.selection}
            onSelectionChange={(event) => vm.setSelection(event.nativeEvent.selection)}
            error={errors.body ?? errors.content}
            maxLength={BODY_MAX_LENGTH}
            placeholder="Write something… Markdown works: **bold**, # headings, - [ ] tasks"
            multiline
            style={{ minHeight: BODY_MIN_HEIGHT }}
          />
        </>
      ) : (
        <View accessibilityLabel="Note preview" style={{ minHeight: BODY_MIN_HEIGHT }}>
          {draft.body.trim() === '' ? (
            <Text tone="muted">Nothing to preview yet.</Text>
          ) : (
            <MarkdownView source={draft.body} onToggleTask={vm.tickTask} />
          )}
        </View>
      )}
    </>
  );

  const details = (
    <>
      <FormSection title="Folder" error={errors.folder}>
        <View style={WRAP_ROW}>
          <Chip
            icon="folder"
            label={folderLabel}
            accessibilityLabel={`Folder ${folderLabel}. Change`}
            onPress={() => setPickingFolder(true)}
          />
        </View>
      </FormSection>
      <TagsSection
        tags={vm.tags}
        selectedIds={draft.tagIds}
        onToggle={vm.toggleTag}
        onCreate={() => setCreatingTag(true)}
      />
      <ColorSection color={draft.color} error={errors.color} onChange={vm.setColor} />
      <DateTimeSection
        title="Reminder"
        emptyLabel="Add reminder"
        dayLabel={draft.reminderAt === null ? null : formatDay(draft.reminderAt, vm.now)}
        timeLabel={draft.reminderAt === null ? null : formatTime(draft.reminderAt)}
        error={errors.reminder}
        onPickDay={() => void vm.pickReminderDay()}
        onPickTime={() => void vm.pickReminderTime()}
        onClear={vm.clearReminder}
      />
      <FormSection title="Protection">
        <SwitchRow
          title="Lock this note"
          subtitle="Needs your PIN, fingerprint or screen lock to open"
          value={draft.locked}
          onChange={toggleLock}
        />
      </FormSection>
      <AttachmentsSection
        attachments={vm.attachments}
        uriOf={vm.uriOf}
        loadDrawing={vm.loadDrawing}
        busy={vm.attaching}
        error={vm.attachmentError}
        onAdd={(kind) => void vm.addAttachment(kind)}
        onOpen={(attachment) => void vm.openAttachment(attachment)}
        onRemove={vm.removeAttachment}
      />
    </>
  );

  return (
    <>
      {header}
      <Screen maxWidth={wide ? WIDE_MAX_WIDTH : undefined}>
        {inactive ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <Text tone="muted" accessibilityRole="alert" style={{ flex: 1 }}>
              {note?.deletedAt != null ? 'This note is in the trash.' : 'This note is archived.'}
            </Text>
            <Button label="Restore" variant="tonal" onPress={() => void vm.restore()} />
          </View>
        ) : null}
        {wide ? (
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.lg }}>
            <View style={{ flex: 3, gap: spacing.lg }}>{writing}</View>
            <View style={{ flex: 2, gap: spacing.lg }}>{details}</View>
          </View>
        ) : (
          <>
            {writing}
            {details}
          </>
        )}
        {vm.saveError ? (
          <Text tone="error" accessibilityLiveRegion="polite">
            {vm.saveError}
          </Text>
        ) : null}
        <Button
          label={vm.isEditing ? 'Save changes' : 'Save note'}
          fullWidth
          loading={vm.saving}
          onPress={() => void vm.save()}
        />
        {vm.isEditing && !inactive ? (
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <Button
              label="Archive"
              variant="outlined"
              icon="archive"
              onPress={() => void vm.archive()}
            />
            <Button
              label="Move to trash"
              variant="outlined"
              icon="delete"
              onPress={vm.confirmTrash}
            />
          </View>
        ) : null}
      </Screen>

      {pickingFolder ? (
        <FolderPickerSheet
          title="Move to folder"
          tree={tree.data ?? []}
          selected={draft.folderId}
          noneLabel="No folder"
          onSelect={vm.setFolder}
          onClose={() => setPickingFolder(false)}
        />
      ) : null}
      {creatingTag ? (
        <NameColorSheet
          title="New tag"
          initialName=""
          initialColor={ACCENT_COLORS[0]}
          onSave={async (name, color) => {
            const error = await vm.createTag(name, color);
            if (error === null) {
              setCreatingTag(false);
            }
            return error;
          }}
          onClose={() => setCreatingTag(false)}
        />
      ) : null}
      {vm.overlay?.kind === 'recorder' ? (
        <RecorderSheet
          onRecorded={(recording) => void vm.saveRecording(recording)}
          onClose={vm.closeOverlay}
        />
      ) : null}
      {vm.overlay?.kind === 'drawing' ? (
        <DrawingModal
          initial={vm.overlay.initial}
          onSave={(drawing) => void vm.saveDrawing(drawing)}
          onClose={vm.closeOverlay}
        />
      ) : null}
      {vm.overlay?.kind === 'image' ? (
        <ImageViewer
          uri={vm.uriOf(vm.overlay.attachment)}
          name={vm.overlay.attachment.name}
          onClose={vm.closeOverlay}
        />
      ) : null}
    </>
  );
}
