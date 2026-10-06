import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect } from 'react';

import { useOnAppForeground } from '@/hooks';

import { useBackupModule } from './module';

/** Headless component that makes the automatic backup when the app opens or returns, if one is due. */
export function AutoBackupBridge() {
  const { backups } = useBackupModule();
  const client = useQueryClient();

  const check = useCallback(() => {
    backups
      .runAutoBackupIfDue()
      .then((made) =>
        made === null ? undefined : client.invalidateQueries({ queryKey: ['backup', 'list'] }),
      )
      .catch(() => undefined);
  }, [backups, client]);

  useEffect(check, [check]);
  useOnAppForeground(check);
  return null;
}
