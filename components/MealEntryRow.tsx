import React, { useCallback, useEffect, useRef } from 'react';
import { Pressable } from 'react-native';
import ReanimatedSwipeable, {
  SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';
import Reanimated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  SharedValue,
} from 'react-native-reanimated';
import { FoodEntry } from '../types/models';
import { useApp } from '../hooks/useApp';
import { Row, Txt } from './ui';
import { usePagerLock } from './PagerGestures';
import { format } from '../services/nutrition';
import { s } from '../i18n/zh-CN';

const actionWidth = 84;
const rowEntering = FadeIn.duration(90);
const rowExiting = FadeOut.duration(80);
const rowLayout = LinearTransition.duration(110);

export function MealEntryRow({
  entry,
  onPress,
  onDelete,
  open,
  onInteractionStart,
  onOpen,
  onClose,
}: {
  entry: FoodEntry;
  onPress: () => void;
  onDelete: () => void;
  open: boolean;
  onInteractionStart: () => void;
  onOpen: () => void;
  onClose: () => void;
}) {
  const { colors } = useApp();
  const { lock, unlock } = usePagerLock();
  const swipeableRef = useRef<SwipeableMethods>(null);
  const wasOpen = useRef(open);

  useEffect(() => {
    if (wasOpen.current && !open) swipeableRef.current?.close();
    wasOpen.current = open;
  }, [open]);

  const beginInteraction = () => {
    lock();
    if (!open) onInteractionStart();
  };
  const renderRightActions = useCallback(
    (
      _progress: SharedValue<number>,
      _translation: SharedValue<number>,
      methods: SwipeableMethods,
    ) => (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${s.remove} ${entry.foodName}`}
        accessibilityElementsHidden={!open}
        aria-hidden={!open}
        disabled={!open}
        onPress={() => {
          methods.close();
          onClose();
          onDelete();
        }}
        style={({ pressed }) => ({
          width: actionWidth,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.danger,
          opacity: pressed ? 0.78 : 1,
        })}
      >
        <Txt bold color={colors.onDanger}>
          {s.remove}
        </Txt>
      </Pressable>
    ),
    [colors.danger, colors.onDanger, entry.foodName, onClose, onDelete, open],
  );

  return (
    <Reanimated.View
      testID="meal-entry-row"
      collapsable={false}
      entering={rowEntering}
      exiting={rowExiting}
      layout={rowLayout}
      onTouchStart={beginInteraction}
      onTouchEnd={unlock}
      onTouchCancel={unlock}
      onPointerDown={beginInteraction}
      onPointerUp={unlock}
      onPointerCancel={unlock}
      onPointerLeave={unlock}
      style={{
        backgroundColor: colors.surface,
        borderLeftWidth: 1,
        borderRightWidth: 1,
        borderBottomWidth: 1,
        borderColor: colors.border,
        overflow: 'hidden',
      }}
    >
      <ReanimatedSwipeable
        ref={swipeableRef}
        friction={1}
        rightThreshold={32}
        dragOffsetFromRightEdge={18}
        overshootLeft={false}
        overshootRight={false}
        renderRightActions={renderRightActions}
        onSwipeableWillOpen={onOpen}
        onSwipeableWillClose={onClose}
        containerStyle={{ backgroundColor: colors.surface }}
        childrenContainerStyle={{ backgroundColor: colors.surface }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={entry.foodName}
          onPress={() => {
            if (open) {
              swipeableRef.current?.close();
              onClose();
            } else {
              onPress();
            }
          }}
          style={({ pressed }) => ({
            paddingHorizontal: 12,
            paddingVertical: 8,
            backgroundColor: colors.surface,
            opacity: pressed ? 0.68 : 1,
          })}
        >
          <Row>
            <Reanimated.View style={{ flex: 1, gap: 2 }}>
              <Txt size={14}>{entry.foodName}</Txt>
              <Txt muted size={11}>
                {entry.amount}
                {entry.unit} · {s.protein} {format(entry.protein, 'protein')}g
              </Txt>
            </Reanimated.View>
            <Txt size={12}>{format(entry.calories)} kcal</Txt>
          </Row>
        </Pressable>
      </ReanimatedSwipeable>
    </Reanimated.View>
  );
}
