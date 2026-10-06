import { Stack, useRouter } from 'expo-router';

import { Button, EmptyState, Screen, Snackbar, Text } from '@/components';
import { useTranslator } from '@/i18n';

import { SessionDetailsFields } from '../components/SessionDetailsFields';
import { useSessionDetailsViewModel } from '../view-models/useSessionDetailsViewModel';

/** Edit the note, task, habit and tags of a saved focus session. */
export function SessionDetailsScreen({ id }: { id: string }) {
  const { t } = useTranslator();
  const vm = useSessionDetailsViewModel(id);
  const router = useRouter();

  return (
    <>
      <Stack.Screen options={{ title: t('Session details') }} />
      <Screen>
        {vm.details === null ? (
          vm.isLoading ? null : (
            <EmptyState
              icon="history"
              title={vm.isError ? t("Couldn't load this session") : t('Session not found')}
              message={
                vm.isError
                  ? t('Go back and try again.')
                  : t('It may have been deleted from your history.')
              }
              actionLabel={t('Back to history')}
              onAction={() => router.back()}
            />
          )
        ) : (
          <>
            <SessionDetailsFields
              title={t('About this session')}
              details={vm.details}
              tasks={vm.tasks}
              habits={vm.habits}
              tags={vm.tags}
              onChange={vm.edit}
              onManageTags={() => router.push('/pomodoro/tags')}
            />
            <Text variant="labelSmall" tone="muted">
              {t('The time and score of a finished session cannot be changed.')}
            </Text>
            <Button
              label={t('Save')}
              icon="check"
              loading={vm.saving}
              disabled={!vm.dirty}
              onPress={() => void vm.save()}
            />
          </>
        )}
      </Screen>
      {vm.failure ? <Snackbar message={vm.failure} onDismiss={vm.dismissFailure} /> : null}
    </>
  );
}
