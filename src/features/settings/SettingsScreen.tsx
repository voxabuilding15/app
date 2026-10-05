import { Screen } from '@/components';

import { AboutSection } from './components/AboutSection';
import { AppearanceSection } from './components/AppearanceSection';
import { NotificationsSection } from './components/NotificationsSection';

export function SettingsScreen() {
  return (
    <Screen>
      <AppearanceSection />
      <NotificationsSection />
      <AboutSection />
    </Screen>
  );
}
