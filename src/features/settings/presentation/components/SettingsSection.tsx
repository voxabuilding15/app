import type { PropsWithChildren } from 'react';

import { Card, SectionHeader } from '@/components';
import { spacing } from '@/theme';

/** A titled group of settings. */
export function SettingsSection({ title, children }: PropsWithChildren<{ title: string }>) {
  return (
    <>
      <SectionHeader title={title} />
      <Card style={{ gap: spacing.md }}>{children}</Card>
    </>
  );
}
