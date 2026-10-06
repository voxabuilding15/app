import { useEffect, useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';

import { Button, Chip, Sheet, Text, WRAP_ROW } from '@/components';
import { useTranslator } from '@/i18n';
import { spacing } from '@/theme';

import type { ConflictPolicy, TableAnalysis } from '../../domain/merge';
import type { RestoreMode } from '../../domain/usecases';
import { formatWhen } from '../format';
import type { BackupViewModel } from '../view-models/useBackupViewModel';

type Counts = { tables: TableAnalysis[]; totals: Record<string, number> };

/** Shows what a backup holds and lets the person choose between replacing and merging. */
export function RestoreSheet({ vm }: { vm: BackupViewModel }) {
  const { t, locale } = useTranslator();
  const candidate = vm.candidate;
  const [mode, setMode] = useState<RestoreMode>('merge');
  const [policy, setPolicy] = useState<ConflictPolicy>('newest');
  const [counts, setCounts] = useState<Counts | null>(null);
  const { analyze } = vm;

  const name = candidate?.name ?? null;
  useEffect(() => {
    let active = true;
    if (name !== null && mode === 'merge') {
      void analyze(policy).then((analysis) => {
        if (active) {
          setCounts(analysis);
        }
      });
    }
    return () => {
      active = false;
    };
    // `analyze` changes every render; what matters is which backup, mode and policy are chosen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, mode, policy]);

  if (candidate === null) {
    return null;
  }
  const { summary } = candidate;
  const total = counts?.totals;

  const confirm = () => {
    if (mode === 'merge') {
      void vm.restore(mode, policy);
      return;
    }
    Alert.alert(
      t('Replace everything?'),
      t(
        'All data on this device will be replaced by the backup. A copy of your current data is saved first, so you can undo this.',
      ),
      [
        { text: t('Cancel'), style: 'cancel' },
        { text: t('Replace'), style: 'destructive', onPress: () => void vm.restore(mode, policy) },
      ],
    );
  };

  const policies: { value: ConflictPolicy; label: string; hint: string }[] = [
    {
      value: 'newest',
      label: t('Newest wins'),
      hint: t('The most recently edited version is kept'),
    },
    { value: 'keep-local', label: t('Keep this device'), hint: t('Your current version is kept') },
    {
      value: 'keep-backup',
      label: t('Keep the backup'),
      hint: t("The backup's version replaces yours"),
    },
  ];

  return (
    <Sheet visible title={t('Restore backup')} onClose={vm.closeCandidate}>
      <ScrollView style={{ maxHeight: 520 }} contentContainerStyle={{ gap: spacing.md }}>
        <View
          accessible
          accessibilityLabel={`${candidate.name}. ${formatWhen(summary.createdAt, locale)}. ${t('{count} items', { count: summary.rows })}`}
          style={{ gap: spacing.xs }}
        >
          <Text variant="titleMedium">{candidate.name}</Text>
          <Text tone="muted">{formatWhen(summary.createdAt, locale)}</Text>
          <Text tone="muted">
            {t('{count} items', { count: summary.rows })}
            {summary.files > 0 ? ` · ${t('{count} attachments', { count: summary.files })}` : ''}
          </Text>
          {summary.skippedFiles > 0 ? (
            <Text variant="labelSmall" tone="muted">
              {t('{count} attachments were not included in this backup', {
                count: summary.skippedFiles,
              })}
            </Text>
          ) : null}
        </View>

        <View style={WRAP_ROW}>
          <Chip
            label={t('Merge with my data')}
            selected={mode === 'merge'}
            onPress={() => setMode('merge')}
          />
          <Chip
            label={t('Replace everything')}
            selected={mode === 'replace'}
            onPress={() => setMode('replace')}
          />
        </View>

        {mode === 'merge' ? (
          <View style={{ gap: spacing.sm }}>
            <Text variant="labelLarge">{t('If the same item differs')}</Text>
            <View style={WRAP_ROW}>
              {policies.map((option) => (
                <Chip
                  key={option.value}
                  label={t(option.label)}
                  selected={policy === option.value}
                  onPress={() => setPolicy(option.value)}
                />
              ))}
            </View>
            <Text variant="labelSmall" tone="muted">
              {policies.find((option) => option.value === policy)?.hint}
            </Text>
            {total === undefined ? null : (
              <View accessibilityLiveRegion="polite" style={{ gap: spacing.xs }}>
                <Text>{t('{count} new items will be added', { count: total.added ?? 0 })}</Text>
                <Text tone="muted">
                  {t('{count} are already here', { count: total.identical ?? 0 })}
                </Text>
                <Text tone="muted">
                  {t('{count} differ, {taken} will come from the backup', {
                    count: total.conflicts ?? 0,
                    taken: total.takenFromBackup ?? 0,
                  })}
                </Text>
              </View>
            )}
            <Text variant="labelSmall" tone="muted">
              {t('Nothing on this device is deleted when merging.')}
            </Text>
          </View>
        ) : (
          <Text tone="error">
            {t(
              'Everything on this device will be replaced. A copy of your current data is saved first.',
            )}
          </Text>
        )}

        <Button
          label={mode === 'merge' ? t('Merge backup') : t('Replace with backup')}
          icon="restore"
          loading={vm.busy === 'restore'}
          onPress={confirm}
        />
      </ScrollView>
    </Sheet>
  );
}
