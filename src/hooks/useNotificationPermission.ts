import { useCallback, useEffect, useState } from 'react';
import { Linking } from 'react-native';

import { useContainer, type PermissionState } from '@/core';

export interface NotificationPermission {
  state: PermissionState;
  request: () => Promise<void>;
}

export function useNotificationPermission(): NotificationPermission {
  const { notifications } = useContainer();
  const [state, setState] = useState<PermissionState>('undetermined');

  useEffect(() => {
    let active = true;
    void notifications.getPermissionState().then((next) => {
      if (active) {
        setState(next);
      }
    });
    return () => {
      active = false;
    };
  }, [notifications]);

  const request = useCallback(async () => {
    if (state === 'denied') {
      await Linking.openSettings();
      return;
    }
    setState(await notifications.requestPermission());
  }, [notifications, state]);

  return { state, request };
}
