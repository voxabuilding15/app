import { useRouter } from 'expo-router';
import { useState } from 'react';

import { useDiscardGuard } from '@/hooks';

import { usePomodoroModule } from '../module';
import { useInvalidatePomodoro, useLinkTargets, useSession, useTags } from '../queries';
import type { SessionDetails } from '../components/SessionDetailsFields';
import { useTranslator } from '@/i18n';

export function useSessionDetailsViewModel(id: string) {
  const { t } = useTranslator();
  const { sessions } = usePomodoroModule();
  const invalidate = useInvalidatePomodoro();
  const router = useRouter();
  const session = useSession(id);
  const targets = useLinkTargets();
  const tags = useTags();
  const [edits, setEdits] = useState<Partial<SessionDetails>>({});
  const [failure, setFailure] = useState<string | null>(null);

  const record = session.data;
  const details: SessionDetails | null =
    record === null || record === undefined
      ? null
      : {
          taskId: record.taskId,
          habitId: record.habitId,
          tagIds: record.tagIds,
          note: record.note,
          ...edits,
        };
  const dirty = Object.keys(edits).length > 0;
  const [saving, setSaving] = useState(false);
  const allowLeaving = useDiscardGuard(dirty, saving);

  const save = async () => {
    if (details === null) {
      return;
    }
    setSaving(true);
    try {
      const saved = await sessions.updateDetails(id, details);
      if (!saved) {
        setFailure(t('This session no longer exists.'));
        return;
      }
      allowLeaving();
      await invalidate();
      router.back();
    } catch {
      setFailure(t("Couldn't save your changes. Try again."));
    } finally {
      setSaving(false);
    }
  };

  return {
    details,
    isLoading: session.isPending,
    notFound: session.isSuccess && record === null,
    isError: session.isError,
    tasks: targets.data?.tasks ?? [],
    habits: targets.data?.habits ?? [],
    tags: tags.data ?? [],
    edit: (changes: Partial<SessionDetails>) => setEdits((current) => ({ ...current, ...changes })),
    dirty,
    saving,
    save,
    failure,
    dismissFailure: () => setFailure(null),
  };
}
