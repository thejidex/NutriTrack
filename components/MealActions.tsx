import React from 'react';
import { Modal, Pressable, View } from 'react-native';
import { useApp } from '../hooks/useApp';
import { Button, Card, Txt } from './ui';
import { s } from '../i18n/zh-CN';

export function MealActions({
  mealName,
  busy,
  onCopy,
  onClear,
  onClose,
}: {
  mealName: string;
  busy: boolean;
  onCopy: () => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const { colors } = useApp();
  return (
    <Modal transparent animationType="none" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'center', padding: 18 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={s.cancel}
          onPress={onClose}
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            backgroundColor: colors.overlay,
          }}
        />
        <Card style={{ width: '100%', maxWidth: 450, alignSelf: 'center' }}>
          <Txt size={20} bold>
            {mealName} · {s.mealActions}
          </Txt>
          <Txt muted size={13}>
            {s.copyPreviousMealHint}
          </Txt>
          <Button
            secondary
            title={s.copyPreviousMeal}
            disabled={busy}
            onPress={() => {
              onCopy();
              onClose();
            }}
          />
          <Button
            danger
            title={s.clearMeal}
            disabled={busy}
            onPress={() => {
              onClear();
              onClose();
            }}
          />
          <Button secondary title={s.cancel} disabled={busy} onPress={onClose} />
        </Card>
      </View>
    </Modal>
  );
}
