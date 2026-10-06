import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';

import type { StoredFile } from '@/core';
import { useNotice } from '@/hooks';
import { useLanguageStore } from '@/i18n/store';
import { useTranslator } from '@/i18n';
import { useThemeStore } from '@/theme/store';

import type { CloudProviderState } from '../../domain/cloud';
import type { ParseFailure } from '../../domain/format';
import type { ConflictPolicy } from '../../domain/merge';
import { RestoreError } from '../../domain/ports';
import type {
  BackupSummary,
  InspectResult,
  RestoreMode,
  RestoreResult,
  StoredBackup,
} from '../../domain/usecases';
import type { AutoBackupSettings } from '../../domain/settings';
import { useBackupModule } from '../module';

/** A backup chosen for restoring, with the numbers the person needs to decide. */
export interface Candidate {
  backup: Extract<InspectResult, { ok: true }>['backup'];
  summary: BackupSummary;
  /** What this backup is called, e.g. its file name. */
  name: string;
}

const ROOT = ['backup'] as const;

export function useBackupViewModel() {
  const { backups, cloud } = useBackupModule();
  const { t } = useTranslator();
  const client = useQueryClient();
  const { notice, show, dismiss } = useNotice();
  const [busy, setBusy] = useState<string | null>(null);
  const [includeFiles, setIncludeFiles] = useState(true);
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [result, setResult] = useState<RestoreResult | null>(null);
  const [auto, setAuto] = useState<AutoBackupSettings>(() => backups.autoSettings());

  const list = useQuery({
    queryKey: [...ROOT, 'list'],
    queryFn: () => backups.list(),
    staleTime: 0,
  });
  const providers = useQuery({ queryKey: [...ROOT, 'cloud'], queryFn: () => cloud.providers() });

  const refresh = useCallback(
    () => client.invalidateQueries({ queryKey: [...ROOT, 'list'] }),
    [client],
  );

  const explain = useCallback(
    (reason: ParseFailure): string => {
      switch (reason) {
        case 'too-new':
          return t(
            'This backup was made by a newer version of the app. Update FocusFlow to restore it.',
          );
        case 'corrupt':
          return t('This backup file is damaged or was changed, so it cannot be trusted.');
        default:
          return t('This file is not a FocusFlow backup.');
      }
    },
    [t],
  );

  const task = useCallback(
    async (name: string, work: () => Promise<void>, failure: string) => {
      if (busy !== null) {
        return;
      }
      setBusy(name);
      try {
        await work();
      } catch {
        show({ message: failure });
      } finally {
        setBusy(null);
      }
    },
    [busy, show],
  );

  const open = useCallback(
    (text: string, name: string) => {
      const inspected = backups.inspect(text);
      if (!inspected.ok) {
        show({ message: explain(inspected.reason) });
        return;
      }
      setResult(null);
      setCandidate({ backup: inspected.backup, summary: inspected.summary, name });
    },
    [backups, show, explain],
  );

  return {
    backups: list.data ?? [],
    isLoading: list.isPending,
    providers: providers.data ?? ([] as CloudProviderState[]),
    busy,
    includeFiles,
    setIncludeFiles,
    auto,
    lastAutoAt: backups.lastAutoBackupAt(),
    candidate,
    closeCandidate: () => setCandidate(null),
    result,
    dismissResult: () => setResult(null),
    notice,
    dismissNotice: dismiss,

    saveNow: () =>
      task(
        'save',
        async () => {
          await backups.create('manual', includeFiles);
          await refresh();
          show({ message: t('Backup saved on this device') });
        },
        t("Couldn't create the backup. Is there enough free space?"),
      ),

    exportFile: () =>
      task(
        'export',
        async () => {
          const exported = await backups.exportAndShare(includeFiles, t('Share backup'));
          await refresh();
          show({
            message: exported.shared
              ? t('Backup exported')
              : t('Backup saved, but no app can open it on this device'),
          });
        },
        t("Couldn't export the backup."),
      ),

    importFile: () =>
      task(
        'import',
        async () => {
          const picked = await backups.pickFile();
          if (picked !== null) {
            open(await backups.readPicked(picked.uri), picked.name);
          }
        },
        t("Couldn't read that file."),
      ),

    openStored: (file: StoredFile) =>
      task(
        'open',
        async () => open(await backups.readStored(file.path), file.name),
        t("Couldn't read that backup."),
      ),

    shareStored: (file: StoredFile) =>
      task(
        'share',
        async () => {
          const shared = await backups.share(file, t('Share backup'));
          if (!shared) {
            show({ message: t('No app on this device can open it') });
          }
        },
        t("Couldn't share that backup."),
      ),

    deleteStored: (entry: StoredBackup) =>
      task(
        'delete',
        async () => {
          await backups.remove(entry.file.path);
          await refresh();
          show({ message: t('Backup deleted') });
        },
        t("Couldn't delete that backup."),
      ),

    changeAuto: (changes: Partial<AutoBackupSettings>) => {
      const next = { ...auto, ...changes };
      backups.saveAutoSettings(next);
      setAuto(backups.autoSettings());
    },

    analyze: (policy: ConflictPolicy) =>
      candidate === null ? Promise.resolve(null) : backups.analyze(candidate.backup, policy),

    restore: (mode: RestoreMode, policy: ConflictPolicy) =>
      task(
        'restore',
        async () => {
          if (candidate === null) {
            return;
          }
          try {
            const done = await backups.restore(candidate.backup, { mode, policy });
            // Settings that live in memory have to read what was just written.
            await Promise.all([
              useThemeStore.persist.rehydrate(),
              useLanguageStore.persist.rehydrate(),
            ]);
            await client.invalidateQueries();
            setCandidate(null);
            setResult(done);
          } catch (error) {
            show({
              message:
                error instanceof RestoreError
                  ? t('The backup could not be restored, so nothing was changed. ({reason})', {
                      reason: error.message,
                    })
                  : t('The backup could not be restored, so nothing was changed.'),
            });
          }
        },
        t('The backup could not be restored, so nothing was changed.'),
      ),
  };
}

export type BackupViewModel = ReturnType<typeof useBackupViewModel>;
