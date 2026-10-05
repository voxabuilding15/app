import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react-native';
import type { ReactElement } from 'react';

import {
  ContainerProvider,
  type Container,
  type NotificationResponse,
  type NotificationService,
} from '@/core';
import { SqliteCategoryRepository } from '@/database/category-repository';
import { getCalendarModule } from '@/features/calendar/presentation/module';
import { getHabitsModule } from '@/features/habits/presentation/module';
import { getTasksModule } from '@/features/tasks/presentation/module';
import { ThemeProvider } from '@/theme';

import { createTestDatabase } from '../tasks/test-database';

/** The mocked router shared with every screen under test (see setup.tsx). */
export const router: Record<'push' | 'back' | 'navigate', jest.Mock> = (
  jest.requireMock('expo-router') as { useRouter: () => never }
).useRouter();

export interface FakeNotifications extends NotificationService {
  scheduled: string[];
  cancelled: string[];
  /** Simulates the user tapping a notification or one of its action buttons. */
  emit: (response: NotificationResponse) => void;
  launchResponse: NotificationResponse | null;
}

function createFakeNotifications(): FakeNotifications {
  const scheduled: string[] = [];
  const cancelled: string[] = [];
  const listeners = new Set<(response: NotificationResponse) => void>();
  return {
    scheduled,
    cancelled,
    launchResponse: null,
    emit: (response) => listeners.forEach((listener) => listener(response)),
    initialize: async () => undefined,
    getPermissionState: async () => 'granted',
    requestPermission: async () => 'granted',
    scheduleAt: async (input) => {
      scheduled.push(input.title);
      return `n-${scheduled.length}`;
    },
    scheduleRecurring: async (input) => {
      scheduled.push(input.title);
      return `r-${scheduled.length}`;
    },
    cancel: async (id) => void cancelled.push(id),
    cancelAll: async () => undefined,
    onResponse: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    consumeInitialResponse() {
      const response = this.launchResponse;
      this.launchResponse = null;
      return response;
    },
  };
}

export function createApp() {
  const notifications = createFakeNotifications();
  const db = createTestDatabase();
  const clock = { now: () => Date.now() };
  const container: Container = {
    clock,
    db,
    categories: (kind) => new SqliteCategoryRepository(db, kind, clock.now),
    storage: { getString: () => undefined, setString: () => undefined, remove: () => undefined },
    notifications,
  };
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity, gcTime: 0 } },
  });
  return {
    container,
    client,
    tasks: getTasksModule(container),
    habits: getHabitsModule(container).habits,
    calendar: getCalendarModule(container).calendar,
    notifications,
  };
}

export type TestApp = ReturnType<typeof createApp>;

/** Renders `ui` against a fresh in-memory database, or against `app` to share seeded data. */
export async function renderWithApp(ui: ReactElement, app: TestApp = createApp()) {
  const utils = await render(
    <ContainerProvider container={app.container}>
      <QueryClientProvider client={app.client}>
        <ThemeProvider>{ui}</ThemeProvider>
      </QueryClientProvider>
    </ContainerProvider>,
  );
  return { ...utils, ...app };
}
