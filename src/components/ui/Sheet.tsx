import type { PropsWithChildren } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, ScrollView, View } from 'react-native';

import { CONTENT_MAX_WIDTH, radius, spacing, useTheme } from '@/theme';
import { useTranslator } from '@/i18n';

import { Text } from './Text';

export interface SheetProps extends PropsWithChildren {
  visible: boolean;
  title: string;
  onClose: () => void;
}

/** Bottom sheet that becomes a centered, width-capped panel on tablets. */
export function Sheet({ visible, title, onClose, children }: SheetProps) {
  const { t } = useTranslator();
  const { colors } = useTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('Close')}
          onPress={onClose}
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            backgroundColor: '#00000066',
          }}
        />
        <View
          accessibilityViewIsModal
          style={{
            width: '100%',
            maxWidth: CONTENT_MAX_WIDTH,
            maxHeight: '85%',
            alignSelf: 'center',
            borderTopLeftRadius: radius.lg * 1.5,
            borderTopRightRadius: radius.lg * 1.5,
            backgroundColor: colors.surface,
          }}
        >
          <View style={{ alignItems: 'center', paddingTop: spacing.md }}>
            <View
              style={{
                width: 32,
                height: 4,
                borderRadius: 2,
                backgroundColor: colors.outlineVariant,
              }}
            />
          </View>
          <Text
            variant="titleLarge"
            accessibilityRole="header"
            style={{ paddingHorizontal: spacing.xl, paddingVertical: spacing.lg }}
          >
            {title}
          </Text>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              gap: spacing.lg,
              paddingHorizontal: spacing.xl,
              paddingBottom: spacing.xxl,
            }}
          >
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
