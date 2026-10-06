import { useCallback, useState } from 'react';

import { useNotificationPermission } from '@/hooks';

import type { PomodoroSettings, SettingsErrors } from '../../domain/settings';
import { usePomodoroModule } from '../module';
import { usePomodoroSettings, useSetSettings } from '../queries';
import { useTimerActions } from '../use-timer-actions';

/** Settings apply as they are changed; a running phase keeps the length it started with. */
export function useSettingsViewModel() {
  const { timer } = usePomodoroModule();
  const settings = usePomodoroSettings();
  const setSettings = useSetSettings();
  const actions = useTimerActions();
  const notifications = useNotificationPermission();
  const [errors, setErrors] = useState<SettingsErrors>({});

  const update = useCallback(
    async (changes: Partial<PomodoroSettings>) => {
      const result = await timer.saveSettings({ ...timer.settings(), ...changes });
      if (result.ok) {
        setErrors({});
        setSettings(timer.settings());
        // The running timer's alerts depend on the settings (auto-start chain, alarm channel).
        await actions.sync();
      } else {
        setErrors(result.errors);
      }
    },
    [timer, setSettings, actions],
  );

  return { settings, errors, update, notifications };
}
