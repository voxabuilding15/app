import { Card, Divider, ListItem, SectionHeader } from '@/components';
import { APP_NAME, APP_VERSION } from '@/constants/app';
import { useContainer } from '@/core';
import { getSchemaVersion } from '@/database';

export function AboutSection() {
  const { db } = useContainer();

  return (
    <>
      <SectionHeader title="About" />
      <Card>
        <ListItem title={APP_NAME} subtitle={`Version ${APP_VERSION}`} icon="info" />
        <Divider />
        <ListItem
          title="Offline storage"
          subtitle={`All data stays on this device (database v${getSchemaVersion(db)})`}
          icon="lock"
        />
      </Card>
    </>
  );
}
