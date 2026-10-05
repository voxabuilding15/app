import { useEffect, useRef } from 'react';

import { useContainer, type NotificationResponse, type NotificationService } from '@/core';

type Handler = (response: NotificationResponse) => Promise<void> | void;

interface LaunchState {
  response: NotificationResponse | null;
  deliveredTo: Set<string>;
}

/** The notification that launched the app is readable only once, but every feature may care. */
const launchStates = new WeakMap<NotificationService, LaunchState>();

function launchStateFor(service: NotificationService): LaunchState {
  let state = launchStates.get(service);
  if (state === undefined) {
    state = { response: service.consumeInitialResponse(), deliveredTo: new Set() };
    launchStates.set(service, state);
  }
  return state;
}

/**
 * Delivers taps and action-button presses on notifications to `handler`, including the one that
 * launched the app. Each feature passes a unique `scope` and ignores responses that are not its own.
 */
export function useNotificationResponses(scope: string, handler: Handler): void {
  const { notifications } = useContainer();
  const latest = useRef(handler);

  useEffect(() => {
    latest.current = handler;
  });

  useEffect(() => {
    const unsubscribe = notifications.onResponse((response) => void latest.current(response));

    const launch = launchStateFor(notifications);
    if (launch.response !== null && !launch.deliveredTo.has(scope)) {
      launch.deliveredTo.add(scope);
      void latest.current(launch.response);
    }
    return unsubscribe;
  }, [notifications, scope]);
}
