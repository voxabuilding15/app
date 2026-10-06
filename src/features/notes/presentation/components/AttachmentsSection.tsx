import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, View } from 'react-native';

import { Chip, FormSection, Icon, IconButton, Text, WRAP_ROW } from '@/components';
import { radius, spacing, useTheme } from '@/theme';

import type { Attachment, AttachmentKind } from '../../domain/entities';
import type { Drawing } from '../../domain/drawing';
import { ATTACHMENT_ICON, ATTACHMENT_LABEL, formatBytes, formatDuration } from '../format';

import { DrawingSvg } from './DrawingSvg';

const THUMB = 56;

interface AttachmentsSectionProps {
  attachments: readonly Attachment[];
  uriOf: (attachment: Attachment) => string;
  loadDrawing: (attachment: Attachment) => Promise<Drawing | null>;
  busy: boolean;
  error: string | null;
  onAdd: (kind: AttachmentKind) => void;
  onOpen: (attachment: Attachment) => void;
  onRemove: (attachment: Attachment) => void;
}

const ADD_OPTIONS: readonly { kind: AttachmentKind; label: string }[] = [
  { kind: 'image', label: 'Image' },
  { kind: 'pdf', label: 'PDF' },
  { kind: 'audio', label: 'Voice' },
  { kind: 'drawing', label: 'Drawing' },
];

function AudioControl({ uri, durationMs }: { uri: string; durationMs: number | null }) {
  const { colors } = useTheme();
  const player = useAudioPlayer(uri);
  const status = useAudioPlayerStatus(player);

  const toggle = () => {
    if (status.playing) {
      player.pause();
    } else {
      if (status.didJustFinish) {
        void player.seekTo(0);
      }
      player.play();
    }
  };
  const shown = status.playing ? status.currentTime * 1000 : (durationMs ?? 0);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <IconButton
        icon={status.playing ? 'pause' : 'play-arrow'}
        label={status.playing ? 'Pause' : 'Play'}
        onPress={toggle}
      />
      <Text variant="labelLarge" style={{ color: colors.onSurface }}>
        {formatDuration(shown)}
      </Text>
    </View>
  );
}

function DrawingThumb({
  attachment,
  loadDrawing,
}: Pick<AttachmentsSectionProps, 'loadDrawing'> & { attachment: Attachment }) {
  const [drawing, setDrawing] = useState<Drawing | null | undefined>(undefined);
  useEffect(() => {
    let cancelled = false;
    void loadDrawing(attachment).then((loaded) => {
      if (!cancelled) {
        setDrawing(loaded);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [attachment, loadDrawing]);

  if (drawing === undefined) {
    return <ActivityIndicator accessibilityLabel="Loading drawing" />;
  }
  return drawing === null ? (
    <Icon name="broken-image" size={THUMB / 2} />
  ) : (
    <DrawingSvg strokes={drawing.strokes} size={THUMB} />
  );
}

function Thumb({
  attachment,
  uri,
  loadDrawing,
}: { attachment: Attachment; uri: string } & Pick<AttachmentsSectionProps, 'loadDrawing'>) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        width: THUMB,
        height: THUMB,
        borderRadius: radius.md,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.surfaceContainer,
      }}
    >
      {attachment.kind === 'image' ? (
        <Image
          source={{ uri }}
          style={{ width: THUMB, height: THUMB }}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
        />
      ) : attachment.kind === 'drawing' ? (
        <DrawingThumb attachment={attachment} loadDrawing={loadDrawing} />
      ) : (
        <Icon name={ATTACHMENT_ICON[attachment.kind]} size={28} color={colors.primary} />
      )}
    </View>
  );
}

/** What is attached to a note, with buttons to add more. */
export function AttachmentsSection({
  attachments,
  uriOf,
  loadDrawing,
  busy,
  error,
  onAdd,
  onOpen,
  onRemove,
}: AttachmentsSectionProps) {
  return (
    <FormSection title="Attachments" error={error ?? undefined}>
      <View style={WRAP_ROW}>
        {ADD_OPTIONS.map((option) => (
          <Chip
            key={option.kind}
            icon={ATTACHMENT_ICON[option.kind]}
            label={option.label}
            accessibilityLabel={`Add ${ATTACHMENT_LABEL[option.kind].toLowerCase()}`}
            onPress={() => onAdd(option.kind)}
          />
        ))}
        {busy ? <ActivityIndicator accessibilityLabel="Adding attachment" /> : null}
      </View>
      {attachments.map((attachment) => {
        const detail =
          attachment.kind === 'audio' && attachment.durationMs !== null
            ? formatDuration(attachment.durationMs)
            : formatBytes(attachment.sizeBytes);
        return (
          <View
            key={attachment.id}
            style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}
          >
            <Pressable
              accessible
              accessibilityRole="button"
              accessibilityLabel={`${ATTACHMENT_LABEL[attachment.kind]}: ${attachment.name}, ${detail}`}
              accessibilityHint={
                attachment.kind === 'drawing' ? 'Edits the drawing' : 'Opens the file'
              }
              onPress={() => onOpen(attachment)}
              style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md }}
            >
              <Thumb attachment={attachment} uri={uriOf(attachment)} loadDrawing={loadDrawing} />
              <View style={{ flex: 1 }}>
                <Text variant="bodyMedium" numberOfLines={1}>
                  {attachment.name}
                </Text>
                <Text variant="labelSmall" tone="muted">
                  {detail}
                </Text>
              </View>
            </Pressable>
            {attachment.kind === 'audio' ? (
              <AudioControl uri={uriOf(attachment)} durationMs={attachment.durationMs} />
            ) : null}
            <IconButton
              icon="delete"
              label={`Remove ${attachment.name}`}
              onPress={() => onRemove(attachment)}
            />
          </View>
        );
      })}
    </FormSection>
  );
}

interface ImageViewerProps {
  uri: string;
  name: string;
  onClose: () => void;
}

/** Full-screen view of an attached image. */
export function ImageViewer({ uri, name, onClose }: ImageViewerProps) {
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: '#000000EE', justifyContent: 'center' }}>
        <Image
          source={{ uri }}
          accessibilityLabel={name}
          style={{ width: '100%', height: '85%' }}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
        />
        <View style={{ position: 'absolute', top: spacing.xxl, right: spacing.lg }}>
          <IconButton icon="close" label="Close image" tinted onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}
