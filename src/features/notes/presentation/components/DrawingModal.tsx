import { useCallback, useState } from 'react';
import { Modal, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';

import { Button, IconButton, PressableScale, Text } from '@/components';
import { ACCENT_COLORS, MIN_TOUCH_TARGET, radius, spacing, useTheme } from '@/theme';
import { useTranslator } from '@/i18n';

import { thin, type Drawing, type Point, type Stroke } from '../../domain/drawing';

import { CANVAS_SIZE, DrawingSvg, toDrawing } from './DrawingSvg';
import { msg } from '@/i18n/msg';

const PEN_COLORS = ['#000000', ...ACCENT_COLORS] as const;
const PEN_WIDTHS = [
  { label: msg('Thin pen'), width: 4 },
  { label: msg('Medium pen'), width: 10 },
  { label: msg('Thick pen'), width: 22 },
] as const;
/** Points closer than this (in canvas units) are skipped, which keeps the saved file small. */
const MIN_POINT_DISTANCE = 3;
const MAX_CANVAS_PX = 640;

interface DrawingModalProps {
  /** The sketch to continue, or null to start a blank one. */
  initial: Drawing | null;
  onSave: (drawing: Drawing) => void;
  onClose: () => void;
}

/** Full-screen sketch pad. Mount only while open so it starts fresh each time. */
export function DrawingModal({ initial, onSave, onClose }: DrawingModalProps) {
  const { t } = useTranslator();
  const { colors } = useTheme();
  const { width, height } = useWindowDimensions();
  const [strokes, setStrokes] = useState<Stroke[]>(initial?.strokes ?? []);
  const [current, setCurrent] = useState<Stroke | null>(null);
  const [color, setColor] = useState<string>(PEN_COLORS[0]);
  const [penWidth, setPenWidth] = useState<number>(PEN_WIDTHS[1].width);

  const size = Math.max(240, Math.min(width - spacing.lg * 2, height - 280, MAX_CANVAS_PX));
  const toCanvas = useCallback(
    (x: number, y: number): Point => ({ x: (x / size) * CANVAS_SIZE, y: (y / size) * CANVAS_SIZE }),
    [size],
  );

  const pan = Gesture.Pan()
    .runOnJS(true)
    .minDistance(0)
    .onBegin((event) =>
      setCurrent({ color, width: penWidth, points: [toCanvas(event.x, event.y)] }),
    )
    .onUpdate((event) =>
      setCurrent((stroke) =>
        stroke === null
          ? stroke
          : { ...stroke, points: [...stroke.points, toCanvas(event.x, event.y)] },
      ),
    )
    .onFinalize(() => {
      setCurrent((stroke) => {
        if (stroke !== null) {
          const finished = { ...stroke, points: thin(stroke.points, MIN_POINT_DISTANCE) };
          setStrokes((all) => [...all, finished]);
        }
        return null;
      });
    })
    .withTestId('drawing-canvas');

  const shown = current === null ? strokes : [...strokes, current];

  return (
    <Modal visible animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ flex: 1, padding: spacing.lg, gap: spacing.md, paddingTop: spacing.xxl }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Text variant="titleLarge" accessibilityRole="header" style={{ flex: 1 }}>
              {t('Drawing')}
            </Text>
            <IconButton
              icon="undo"
              label={t('Undo last stroke')}
              disabled={strokes.length === 0}
              onPress={() => setStrokes((all) => all.slice(0, -1))}
            />
            <IconButton
              icon="delete-sweep"
              label={t('Clear drawing')}
              disabled={strokes.length === 0}
              onPress={() => setStrokes([])}
            />
          </View>

          <View style={{ alignItems: 'center' }}>
            <GestureDetector gesture={pan}>
              <View
                accessible
                accessibilityLabel={t('Drawing canvas, {length} {value}', {
                  length: strokes.length,
                  value: strokes.length === 1 ? 'stroke' : 'strokes',
                })}
                style={{
                  borderRadius: radius.md,
                  overflow: 'hidden',
                  borderWidth: 1,
                  borderColor: colors.outline,
                }}
              >
                <DrawingSvg strokes={shown} size={size} />
              </View>
            </GestureDetector>
          </View>

          <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {PEN_COLORS.map((option, index) => (
              <PressableScale
                key={option}
                accessibilityRole="radio"
                accessibilityLabel={
                  index === 0
                    ? t('Black pen')
                    : t('Pen color {index} of {length}', {
                        index: index,
                        length: ACCENT_COLORS.length,
                      })
                }
                accessibilityState={{ selected: option === color }}
                onPress={() => setColor(option)}
                style={{ width: MIN_TOUCH_TARGET, height: MIN_TOUCH_TARGET }}
              >
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                  <View
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 14,
                      backgroundColor: option,
                      borderWidth: option === color ? 3 : 1,
                      borderColor: option === color ? colors.onSurface : colors.outlineVariant,
                    }}
                  />
                </View>
              </PressableScale>
            ))}
          </View>
          <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', gap: spacing.sm }}>
            {PEN_WIDTHS.map((option) => (
              <PressableScale
                key={option.label}
                accessibilityRole="radio"
                accessibilityLabel={t(option.label)}
                accessibilityState={{ selected: option.width === penWidth }}
                onPress={() => setPenWidth(option.width)}
                style={{ width: MIN_TOUCH_TARGET, height: MIN_TOUCH_TARGET }}
              >
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                  <View
                    style={{
                      width: 8 + option.width,
                      height: 8 + option.width,
                      borderRadius: 999,
                      backgroundColor: option.width === penWidth ? colors.primary : colors.outline,
                    }}
                  />
                </View>
              </PressableScale>
            ))}
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.md }}>
            <Button label={t('Cancel')} variant="outlined" onPress={onClose} />
            <Button
              label={t('Save drawing')}
              disabled={strokes.length === 0}
              onPress={() => onSave(toDrawing(strokes))}
            />
          </View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}
