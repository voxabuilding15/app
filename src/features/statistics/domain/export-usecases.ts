import type { Clock, FileService, StoredFile } from '@/core';

import { reportToCsv } from './export-csv';
import { reportToPdf } from './export-pdf';
import type { Words } from './summary';
import type { StatsReport } from './usecases';
import { currentTranslator } from '@/i18n/translate';

export type ExportFormat = 'csv' | 'pdf';

export interface ExportResult {
  file: StoredFile;
  /** False when no app on the device could take the file; it is still saved. */
  shared: boolean;
}

const MIME: Record<ExportFormat, string> = { csv: 'text/csv', pdf: 'application/pdf' };

interface ExportDeps {
  files: FileService;
  clock: Clock;
}

/** Old exports are cleared so the cache does not fill up. */
const KEEP_EXPORTS = 10;

export function createExportUseCases({ files, clock }: ExportDeps) {
  const { t } = currentTranslator();
  return {
    async exportReport(
      report: StatsReport,
      format: ExportFormat,
      words: Words,
    ): Promise<ExportResult> {
      const stamp = new Date(clock.now()).toISOString().replace(/[-:]/g, '').slice(0, 15);
      const name = `focusflow-${report.period}-${report.range.from}-${stamp}.${format}`;
      const path = `exports/${name}`;
      const file =
        format === 'csv'
          ? await files.writeText('cache', path, reportToCsv(report, words))
          : await files.writeBytes('cache', path, reportToPdf(report, words));

      const old = (await files.list('cache', 'exports')).slice(KEEP_EXPORTS);
      await Promise.all(old.map((entry) => files.remove('cache', entry.path)));

      const shared = await files.share(file, MIME[format], words.t(t('Share statistics')));
      return { file, shared };
    },
  };
}

export type ExportUseCases = ReturnType<typeof createExportUseCases>;
