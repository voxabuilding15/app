import { useRouter } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card, ListItem, ScreenToolbar, SectionHeader } from '@/components';
import { useIsTablet } from '@/hooks';
import { useTranslator } from '@/i18n';
import { CONTENT_MAX_WIDTH, spacing, useTheme } from '@/theme';

import { AboutSection } from '../components/AboutSection';
import { AppearanceSection } from '../components/AppearanceSection';
import { DataSection } from '../components/DataSection';
import { LanguageSection } from '../components/LanguageSection';
import { NotificationsSection } from '../components/NotificationsSection';
import { PrivacySection } from '../components/PrivacySection';

const WIDE_MAX_WIDTH = 1100;

/** Theme, language, notifications, data, privacy, security, about and feedback. */
export function SettingsScreen() {
  const { t } = useTranslator();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const isTablet = useIsTablet();

  const first = (
    <>
      <AppearanceSection />
      <LanguageSection />
      <NotificationsSection />
      <PrivacySection />
    </>
  );
  const second = (
    <>
      <DataSection />
      <SectionHeader title={t('Security')} />
      <Card>
        <ListItem
          title={t('App lock')}
          subtitle={t('Fingerprint, face, screen lock or PIN')}
          icon="lock"
          onPress={() => router.push('/settings/security')}
        />
      </Card>
      <SectionHeader title={t('Feedback')} />
      <Card>
        <ListItem
          title={t('Send feedback')}
          subtitle={t('Ideas, problems and thanks')}
          icon="feedback"
          onPress={() => router.push('/settings/feedback')}
        />
      </Card>
      <AboutSection />
    </>
  );

  return (
    <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: colors.background }}>
      <ScreenToolbar title={t('Settings')} />
      <ScrollView
        contentContainerStyle={{
          padding: spacing.lg,
          paddingBottom: spacing.xxl,
          width: '100%',
          maxWidth: isTablet ? WIDE_MAX_WIDTH : CONTENT_MAX_WIDTH,
          alignSelf: 'center',
        }}
      >
        {isTablet ? (
          <View style={{ flexDirection: 'row', gap: spacing.lg, alignItems: 'flex-start' }}>
            <View style={{ flex: 1, gap: spacing.lg }}>{first}</View>
            <View style={{ flex: 1, gap: spacing.lg }}>{second}</View>
          </View>
        ) : (
          <View style={{ gap: spacing.lg }}>
            {first}
            {second}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
