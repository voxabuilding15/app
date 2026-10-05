import { EmptyState, Screen, type IconName } from '@/components';

export interface EmptyFeatureScreenProps {
  icon: IconName;
  title: string;
  message: string;
}

export function EmptyFeatureScreen({ icon, title, message }: EmptyFeatureScreenProps) {
  return (
    <Screen>
      <EmptyState icon={icon} title={title} message={message} />
    </Screen>
  );
}
