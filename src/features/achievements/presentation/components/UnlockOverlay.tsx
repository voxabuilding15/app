import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Modal, View } from 'react-native';

import { Button, Icon, Text, type IconName } from '@/components';
import { useHaptics } from '@/hooks';
import { useTranslator } from '@/i18n';
import { radius, spacing, useTheme } from '@/theme';

import { describeUnlock } from '../../domain/describe';
import type { Unlock } from '../../domain/entities';
import { TIER_COLORS } from '../tiers';

const PARTICLES = 12;
const BADGE_SIZE = 132;

interface UnlockOverlayProps {
  unlock: Unlock;
  /** How many more are waiting behind this one. */
  remaining: number;
  onDismiss: () => void;
  onViewAll: () => void;
}

/** A full-screen celebration: the badge pops in, sparks fly out and the XP is shown. */
export function UnlockOverlay({ unlock, remaining, onDismiss, onViewAll }: UnlockOverlayProps) {
  const { t } = useTranslator();
  const { colors } = useTheme();
  const haptics = useHaptics();
  const text = describeUnlock(unlock);
  const [reduceMotion, setReduceMotion] = useState(false);

  const [backdrop] = useState(() => new Animated.Value(0));
  const [pop] = useState(() => new Animated.Value(0));
  const [spark] = useState(() => new Animated.Value(0));

  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (active) {
        setReduceMotion(enabled);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const key = unlock.key;
  useEffect(() => {
    backdrop.setValue(0);
    pop.setValue(0);
    spark.setValue(0);
    haptics.success();
    if (reduceMotion) {
      backdrop.setValue(1);
      pop.setValue(1);
      spark.setValue(1);
      return undefined;
    }
    const animation = Animated.sequence([
      Animated.timing(backdrop, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.parallel([
        Animated.spring(pop, { toValue: 1, friction: 4, tension: 90, useNativeDriver: true }),
        Animated.timing(spark, {
          toValue: 1,
          duration: 900,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    ]);
    animation.start();
    return () => animation.stop();
  }, [key, reduceMotion, backdrop, pop, spark, haptics]);

  const title = text === null ? '' : t(text.title, { count: text.count });
  const label = text === null ? '' : `${t('Unlocked')}: ${title}. +${unlock.xp} XP`;
  useEffect(() => {
    if (label !== '') {
      AccessibilityInfo.announceForAccessibility(label);
    }
  }, [label]);

  if (text === null) {
    return null;
  }
  const accent = text.tier === null ? colors.primary : TIER_COLORS[text.tier];

  return (
    <Modal transparent animationType="none" statusBarTranslucent onRequestClose={onDismiss}>
      <Animated.View
        accessibilityViewIsModal
        style={{
          flex: 1,
          opacity: backdrop,
          backgroundColor: '#000000D9',
          alignItems: 'center',
          justifyContent: 'center',
          padding: spacing.xl,
        }}
      >
        <View
          style={{
            width: BADGE_SIZE * 2,
            height: BADGE_SIZE * 2,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {Array.from({ length: PARTICLES }, (_, index) => {
            const angle = (index / PARTICLES) * Math.PI * 2;
            const travel = BADGE_SIZE * 0.95;
            return (
              <Animated.View
                key={index}
                importantForAccessibility="no-hide-descendants"
                style={{
                  position: 'absolute',
                  width: 10,
                  height: 10,
                  borderRadius: 5,
                  backgroundColor: index % 2 === 0 ? accent : colors.onPrimary,
                  opacity: spark.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 1, 0] }),
                  transform: [
                    {
                      translateX: spark.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, Math.cos(angle) * travel],
                      }),
                    },
                    {
                      translateY: spark.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, Math.sin(angle) * travel],
                      }),
                    },
                  ],
                }}
              />
            );
          })}
          <Animated.View
            accessible
            accessibilityLabel={label}
            style={{
              width: BADGE_SIZE,
              height: BADGE_SIZE,
              borderRadius: BADGE_SIZE / 2,
              backgroundColor: accent,
              alignItems: 'center',
              justifyContent: 'center',
              transform: [
                { scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] }) },
                {
                  rotate: pop.interpolate({ inputRange: [0, 1], outputRange: ['-25deg', '0deg'] }),
                },
              ],
            }}
          >
            <Icon name={text.icon as IconName} size={64} color="#FFFFFF" />
          </Animated.View>
        </View>

        <View style={{ alignItems: 'center', gap: spacing.sm, marginTop: spacing.lg }}>
          <Text variant="labelLarge" style={{ color: '#FFFFFF' }} accessibilityRole="header">
            {t('Unlocked')}
          </Text>
          <Text variant="headlineSmall" style={{ color: '#FFFFFF', textAlign: 'center' }}>
            {title}
          </Text>
          <Text style={{ color: '#FFFFFFB3', textAlign: 'center' }}>
            {t(text.description, { count: text.count })}
          </Text>
          <View
            style={{
              marginTop: spacing.sm,
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.xs,
              borderRadius: radius.full,
              backgroundColor: '#FFFFFF26',
            }}
          >
            <Text variant="titleMedium" style={{ color: '#FFFFFF' }}>
              +{unlock.xp} XP
            </Text>
          </View>
        </View>

        <View style={{ marginTop: spacing.xl, gap: spacing.sm, alignItems: 'center' }}>
          <Button label={remaining > 0 ? t('Next') : t('Nice!')} onPress={onDismiss} />
          {remaining > 0 ? (
            <Text style={{ color: '#FFFFFFB3' }}>
              {t('{count} more to see', { count: remaining })}
            </Text>
          ) : null}
          <Button label={t('See all achievements')} variant="text" onPress={onViewAll} />
        </View>
      </Animated.View>
    </Modal>
  );
}
