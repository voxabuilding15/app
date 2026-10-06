import { Stack, useRouter } from 'expo-router';

import {
  Button,
  Chip,
  ChipGroup,
  FormSection,
  ListItem,
  NumberStepper,
  Screen,
  SwitchRow,
  Text,
} from '@/components';

import { AMBIENT_SOUNDS, SETTING_RANGES } from '../../domain/settings';
import { MinutesField } from '../components/MinutesField';
import { SOUND_ICON, SOUND_LABEL } from '../format';
import { useSettingsViewModel } from '../view-models/useSettingsViewModel';

function StepperRow({
  title,
  label,
  value,
  min,
  max,
  onChange,
}: {
  title: string;
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <ListItem
      title={title}
      trailing={
        <NumberStepper value={value} min={min} max={max} onChange={onChange} label={label} />
      }
    />
  );
}

/** Durations, automation, sounds, alerts and goals. Changes apply as they are made. */
export function SettingsScreen() {
  const router = useRouter();
  const { settings, errors, update, notifications } = useSettingsViewModel();
  const { focusMinutes, shortBreakMinutes, longBreakMinutes, sessionsUntilLongBreak } =
    SETTING_RANGES;

  return (
    <>
      <Stack.Screen options={{ title: 'Pomodoro settings' }} />
      <Screen>
        <FormSection title="Durations">
          <StepperRow
            title="Focus"
            label="Focus minutes"
            value={settings.focusMinutes}
            {...focusMinutes}
            onChange={(value) => void update({ focusMinutes: value })}
          />
          <StepperRow
            title="Short break"
            label="Short break minutes"
            value={settings.shortBreakMinutes}
            {...shortBreakMinutes}
            onChange={(value) => void update({ shortBreakMinutes: value })}
          />
          <StepperRow
            title="Long break"
            label="Long break minutes"
            value={settings.longBreakMinutes}
            {...longBreakMinutes}
            onChange={(value) => void update({ longBreakMinutes: value })}
          />
          <StepperRow
            title="Sessions before a long break"
            label="Sessions before a long break"
            value={settings.sessionsUntilLongBreak}
            {...sessionsUntilLongBreak}
            onChange={(value) => void update({ sessionsUntilLongBreak: value })}
          />
          <Text variant="labelSmall" tone="muted">
            Durations are in minutes. A running session keeps the length it started with.
          </Text>
        </FormSection>

        <FormSection title="Automation">
          <SwitchRow
            title="Start breaks automatically"
            subtitle="A break begins as soon as a focus session ends"
            value={settings.autoStartBreaks}
            onChange={(value) => void update({ autoStartBreaks: value })}
          />
          <SwitchRow
            title="Start focus automatically"
            subtitle="The next focus session begins as soon as a break ends"
            value={settings.autoStartFocus}
            onChange={(value) => void update({ autoStartFocus: value })}
          />
        </FormSection>

        <FormSection title="Sounds and alerts">
          <ChipGroup title="Ambient sound during focus">
            {AMBIENT_SOUNDS.map((sound) => (
              <Chip
                key={sound}
                icon={SOUND_ICON[sound]}
                label={SOUND_LABEL[sound]}
                selected={settings.ambientSound === sound}
                onPress={() => void update({ ambientSound: sound })}
              />
            ))}
          </ChipGroup>
          <SwitchRow
            title="Tick sound"
            subtitle="A soft tick every second while you focus"
            value={settings.tickSound}
            onChange={(value) => void update({ tickSound: value })}
          />
          <SwitchRow
            title="Vibrate"
            subtitle="Vibrate when a phase ends while the app is open"
            value={settings.vibrate}
            onChange={(value) => void update({ vibrate: value })}
          />
          <SwitchRow
            title="Exact alarm"
            subtitle="Ring through the alarm channel at the exact moment a phase ends, even in Do Not Disturb"
            value={settings.exactAlarm}
            onChange={(value) => void update({ exactAlarm: value })}
          />
          {notifications.state === 'granted' ? null : (
            <>
              <Text variant="bodyMedium" tone="error">
                Notifications are off, so the timer cannot alert you or show its controls when the
                app is closed.
              </Text>
              <Button
                label={notifications.state === 'denied' ? 'Open settings' : 'Allow notifications'}
                variant="tonal"
                onPress={() => void notifications.request()}
              />
            </>
          )}
        </FormSection>

        <FormSection title="Goals">
          <MinutesField
            label="Daily goal (minutes of focus)"
            value={settings.dailyGoalMinutes}
            error={errors.dailyGoalMinutes}
            onCommit={(value) => void update({ dailyGoalMinutes: value })}
          />
          <MinutesField
            label="Weekly goal (minutes of focus)"
            value={settings.weeklyGoalMinutes}
            error={errors.weeklyGoalMinutes}
            onCommit={(value) => void update({ weeklyGoalMinutes: value })}
          />
          <MinutesField
            label="Monthly goal (minutes of focus)"
            value={settings.monthlyGoalMinutes}
            error={errors.monthlyGoalMinutes}
            onCommit={(value) => void update({ monthlyGoalMinutes: value })}
          />
          <Text variant="labelSmall" tone="muted">
            Use 0 to turn a goal off.
          </Text>
        </FormSection>

        <FormSection title="Tags">
          <ListItem
            icon="sell"
            title="Session tags"
            subtitle="Create the tags you can add to focus sessions"
            onPress={() => router.push('/pomodoro/tags')}
          />
        </FormSection>
      </Screen>
    </>
  );
}
