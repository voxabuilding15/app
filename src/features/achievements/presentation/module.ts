import { useContainer, type Container } from '@/core';

import { SqliteAchievementSource } from '../data/sqlite-source';
import { SqliteUnlockRepository } from '../data/sqlite-unlocks';
import { createAchievementUseCases, type AchievementUseCases } from '../domain/usecases';

export interface AchievementsModule {
  achievements: AchievementUseCases;
}

const modules = new WeakMap<Container, AchievementsModule>();

export function getAchievementsModule(container: Container): AchievementsModule {
  const existing = modules.get(container);
  if (existing !== undefined) {
    return existing;
  }
  const module: AchievementsModule = {
    achievements: createAchievementUseCases({
      source: new SqliteAchievementSource(container.db),
      unlocks: new SqliteUnlockRepository(container.db),
      clock: container.clock,
    }),
  };
  modules.set(container, module);
  return module;
}

export function useAchievementsModule(): AchievementsModule {
  return getAchievementsModule(useContainer());
}
