import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react-native';
import type { ReactElement } from 'react';

import {
  ContainerProvider,
  type Container,
  type KeyValueStorage,
  type NotificationResponse,
  type NotificationService,
} from '@/core';
import { SqliteCategoryRepository } from '@/database/category-repository';
import { getCalendarModule } from '@/features/calendar/presentation/module';
import { getFinanceModule } from '@/features/finance/presentation/module';
import { getNotesModule } from '@/features/notes/presentation/module';
import { getHabitsModule } from '@/features/habits/presentation/module';
import { getBackupModule } from '@/features/backup/presentation/module';
import { getAchievementsModule } from '@/features/achievements/presentation/module';
import { getPomodoroModule } from '@/features/pomodoro/presentation/module';
import { getTasksModule } from '@/features/tasks/presentation/module';
import { ThemeProvider } from '@/theme';

import { FakeAuthenticator, FakePicker, FakeStorage } from '../notes/fakes';
import { MemoryFiles } from '../support/memory-files';
import { createTestDatabase } from '../tasks/test-database';

/** The mocked router shared with every screen under test (see setup.tsx). */
export const router: Record<'push' | 'back' | 'navigate', jest.Mock> = (
  jest.requireMock('expo-router') as { useRouter: () => never }
).useRouter();

export interface FakeNotifications extends NotificationService {
  scheduled: string[];
  presented: { title: string; body: string; categoryId?: string }[];
  cancelled: string[];
  /** Simulates the user tapping a notification or one of its action buttons. */
  emit: (response: NotificationResponse) => void;
  launchResponse: NotificationResponse | null;
}

function memoryStorage(): KeyValueStorage {
  const values = new Map<string, string>();
  return {
    getString: (key) => values.get(key),
    setString: (key, value) => void values.set(key, value),
    remove: (key) => void values.delete(key),
  };
}

function createFakeNotifications(): FakeNotifications {
  const scheduled: string[] = [];
  const cancelled: string[] = [];
  const presented: { title: string; body: string; categoryId?: string }[] = [];
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
    present: async (input) => {
      presented.push({ title: input.title, body: input.body, categoryId: input.categoryId });
      return `p-${presented.length}`;
    },
    presented,
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
  const deviceFiles = new MemoryFiles();
  const container: Container = {
    clock,
    db,
    categories: (kind) => new SqliteCategoryRepository(db, kind, clock.now),
    storage: memoryStorage(),
    notifications,
    files: deviceFiles,
  };
  const files = new FakeStorage();
  const picker = new FakePicker();
  const authenticator = new FakeAuthenticator();
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity, gcTime: 0 } },
  });
  return {
    container,
    client,
    tasks: getTasksModule(container),
    habits: getHabitsModule(container).habits,
    calendar: getCalendarModule(container).calendar,
    finance: getFinanceModule(container),
    notes: getNotesModule(container, { storage: files, picker, authenticator }),
    pomodoro: getPomodoroModule(container),
    achievements: getAchievementsModule(container).achievements,
    backup: getBackupModule(container).backups,
    noteFakes: { files, picker, authenticator },
    notifications,
    deviceFiles,
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
