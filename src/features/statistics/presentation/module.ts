import { useContainer, type Container } from '@/core';

import { createStatsSources } from '../data/create-sources';
import { createExportUseCases, type ExportUseCases } from '../domain/export-usecases';
import { createStatsUseCases, type StatsUseCases } from '../domain/usecases';

export interface StatisticsModule {
  stats: StatsUseCases;
  exports: ExportUseCases;
}

const modules = new WeakMap<Container, StatisticsModule>();

/** Wires the statistics use cases to every feature's data, once per container. */
function getStatisticsModule(container: Container): StatisticsModule {
  const existing = modules.get(container);
  if (existing !== undefined) {
    return existing;
  }
  const module: StatisticsModule = {
    stats: createStatsUseCases({ sources: createStatsSources(container), clock: container.clock }),
    exports: createExportUseCases({ files: container.files, clock: container.clock }),
  };
  modules.set(container, module);
  return module;
}

export function useStatisticsModule(): StatisticsModule {
  return getStatisticsModule(useContainer());
}
