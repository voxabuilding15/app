import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';

function open(mode: 'date' | 'time', initial: Date, is24Hour: boolean): Promise<Date | null> {
  return new Promise((resolve) => {
    DateTimePickerAndroid.open({
      value: initial,
      mode,
      is24Hour,
      onChange: (event, date) => resolve(event.type === 'set' && date ? date : null),
      onError: () => resolve(null),
    });
  });
}

/** True when the device locale formats times without AM/PM. */
function uses24HourClock(): boolean {
  return !/am|pm/i.test(new Date(2000, 0, 1, 13).toLocaleTimeString());
}

/** Opens the system date picker; resolves to null if the user cancels. */
export function pickDate(initial: Date): Promise<Date | null> {
  return open('date', initial, false);
}

/** Opens the system time picker; resolves to null if the user cancels. */
export function pickTime(initial: Date): Promise<Date | null> {
  return open('time', initial, uses24HourClock());
}
