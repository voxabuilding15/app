import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from 'expo-audio';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Button, Sheet, Text } from '@/components';
import { spacing } from '@/theme';
import { useTranslator } from '@/i18n';

import { formatDuration } from '../format';

const POLL_MS = 250;

type Phase = 'idle' | 'recording' | 'denied' | 'failed';

interface RecorderSheetProps {
  /** Receives the finished recording. */
  onRecorded: (recording: { uri: string; durationMs: number }) => void;
  onClose: () => void;
}

/** Sheet that records a voice note. Mount only while open: closing it stops any recording. */
export function RecorderSheet({ onRecorded, onClose }: RecorderSheetProps) {
  const { t } = useTranslator();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [phase, setPhase] = useState<Phase>('idle');
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (phase !== 'recording') {
      return undefined;
    }
    const timer = setInterval(() => setElapsed(recorder.getStatus().durationMillis), POLL_MS);
    return () => clearInterval(timer);
  }, [phase, recorder]);

  const start = async () => {
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setPhase('denied');
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setElapsed(0);
      setPhase('recording');
    } catch {
      setPhase('failed');
    }
  };

  const finish = async () => {
    try {
      const durationMs = recorder.getStatus().durationMillis;
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false });
      if (recorder.uri === null) {
        setPhase('failed');
        return;
      }
      onRecorded({ uri: recorder.uri, durationMs });
    } catch {
      setPhase('failed');
    }
  };

  const cancel = async () => {
    if (phase === 'recording') {
      await recorder.stop().catch(() => undefined);
      await setAudioModeAsync({ allowsRecording: false }).catch(() => undefined);
    }
    onClose();
  };

  return (
    <Sheet visible title={t('Voice recording')} onClose={() => void cancel()}>
      <View accessibilityLiveRegion="polite" style={{ alignItems: 'center', gap: spacing.sm }}>
        <Text
          variant="headlineSmall"
          accessibilityLabel={t('Recording time {duration}', { duration: formatDuration(elapsed) })}
        >
          {formatDuration(elapsed)}
        </Text>
        <Text tone={phase === 'denied' || phase === 'failed' ? 'error' : 'muted'}>
          {phase === 'idle'
            ? t('Tap Record to start.')
            : phase === 'recording'
              ? t('Recording…')
              : phase === 'denied'
                ? t('Allow microphone access in your phone settings to record.')
                : t("Couldn't record. Please try again.")}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.md }}>
        <Button label={t('Cancel')} variant="outlined" onPress={() => void cancel()} />
        {phase === 'recording' ? (
          <Button label={t('Stop and save')} icon="stop" onPress={() => void finish()} />
        ) : (
          <Button label={t('Record')} icon="mic" onPress={() => void start()} />
        )}
      </View>
    </Sheet>
  );
}
