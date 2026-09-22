import React, { useCallback, useMemo, useState } from 'react';
import { Modal, PanResponder, View } from 'react-native';
import { Button, Card, Chip, Row, Txt } from './ui';
import { dateKey, parseDate } from '../utils/date';
import { s } from '../i18n/zh-CN';
import { useApp } from '../hooks/useApp';
export function Calendar({
  value,
  onChange,
  onClose,
}: {
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
}) {
  const { colors } = useApp();
  const [month, setMonth] = useState(() => {
    const d = parseDate(value);
    d.setDate(1);
    return d;
  });
  const moveMonth = useCallback((delta: number) => {
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1, 12));
  }, []);
  const monthPanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dx) > 8 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
        onPanResponderRelease: (_, gesture) => {
          if (Math.abs(gesture.dx) >= 48 && Math.abs(gesture.dx) > Math.abs(gesture.dy))
            moveMonth(gesture.dx < 0 ? 1 : -1);
        },
      }),
    [moveMonth],
  );
  const year = month.getFullYear();
  const m = month.getMonth();
  const length = new Date(year, m + 1, 0).getDate();
  const slots = Array.from(
    { length: Math.ceil((month.getDay() + length) / 7) * 7 },
    (_, i) => i - month.getDay() + 1,
  );
  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <View
        style={{ flex: 1, backgroundColor: colors.overlay, padding: 18, justifyContent: 'center' }}
      >
        <View
          testID="calendar-panel"
          {...monthPanResponder.panHandlers}
          style={{ width: '100%', maxWidth: 450, alignSelf: 'center' }}
        >
          <Card style={{ width: '100%' }}>
            <Txt size={20} bold>
              {s.calendar}
            </Txt>
            <Row>
              <Chip title="‹" onPress={() => moveMonth(-1)} />
              <View testID="calendar-month-label">
                <Txt bold>
                  {year} / {m + 1}
                </Txt>
              </View>
              <Chip title="›" onPress={() => moveMonth(1)} />
            </Row>
            <Row style={{ gap: 0 }}>
              {s.weekdays.map((w) => (
                <View key={w} style={{ flex: 1, alignItems: 'center' }}>
                  <Txt size={12} muted>
                    {w}
                  </Txt>
                </View>
              ))}
            </Row>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {slots.map((d, i) => (
                <View key={i} style={{ width: '14.2857%', padding: 1 }}>
                  {d > 0 && d <= length ? (
                    <Chip
                      compact
                      title={String(d)}
                      selected={dateKey(new Date(year, m, d, 12)) === value}
                      onPress={() => {
                        onChange(dateKey(new Date(year, m, d, 12)));
                        onClose();
                      }}
                    />
                  ) : (
                    <View style={{ height: 44 }} />
                  )}
                </View>
              ))}
            </View>
            <Button secondary title={s.cancel} onPress={onClose} />
          </Card>
        </View>
      </View>
    </Modal>
  );
}
