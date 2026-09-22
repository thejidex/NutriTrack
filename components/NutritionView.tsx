import React from 'react';
import { View } from 'react-native';
import { Goals, Metric, Nutrition } from '../types/models';
import { format, isOverLimit, progress } from '../services/nutrition';
import { useApp } from '../hooks/useApp';
import { Row, Txt } from './ui';
import { s } from '../i18n/zh-CN';
export const metrics: Metric[] = ['calories', 'protein', 'carbs', 'fat'];
export function NutritionView({
  value,
  goals = {},
  hero = false,
}: {
  value: Nutrition;
  goals?: Goals;
  hero?: boolean;
}) {
  const { colors, detail } = useApp();
  return (
    <View testID="nutrition-summary" style={{ paddingVertical: 8, gap: 8 }}>
      <Txt size={12} muted>
        {hero ? s.intake : s.preview}
      </Txt>
      <Row style={{ justifyContent: 'flex-start', alignItems: 'baseline' }}>
        <Txt size={34} bold>
          {format(value.calories)}
        </Txt>
        <Txt size={13} muted>
          kcal
        </Txt>
      </Row>
      {!!goals.calories && (
        <>
          <Txt muted size={11}>
            {s.goal} {goals.calories} kcal ·{' '}
            {value.calories > goals.calories ? s.over : s.remaining}{' '}
            {format(Math.abs(goals.calories - value.calories))} kcal
          </Txt>
          <Progress
            value={progress(value.calories, goals.calories)!}
            danger={isOverLimit(value.calories, goals.calories)}
          />
        </>
      )}
      <Row style={{ alignItems: 'flex-start' }}>
        {(['protein', 'carbs', 'fat'] as const).map((key) => (
          <View key={key} style={{ flex: 1, gap: 4 }}>
            <Txt size={12} muted>
              {s[key]}
            </Txt>
            <Txt bold size={17}>
              {format(value[key], key)}
              <Txt size={12} muted>
                {' '}
                g
              </Txt>
            </Txt>
            {!!goals[key] && (
              <>
                <Progress
                  value={progress(value[key], goals[key])!}
                  danger={isOverLimit(value[key], goals[key])}
                />
                <Txt size={11} muted>
                  / {goals[key]} g
                </Txt>
              </>
            )}
          </View>
        ))}
      </Row>
      {detail && (
        <Row style={{ flexWrap: 'wrap' }}>
          {(['saturatedFat', 'fiber', 'sugar', 'sodium'] as const).map((k) => (
            <Txt size={11} muted key={k}>
              {s[k]} {format(value[k], k)} {k === 'sodium' ? 'mg' : 'g'}
            </Txt>
          ))}
        </Row>
      )}
      <View style={{ borderBottomWidth: 1, borderBottomColor: colors.border, marginTop: 6 }} />
    </View>
  );
}
function Progress({ value, danger }: { value: number; danger: boolean }) {
  const { colors } = useApp();
  const fillColor = danger ? colors.danger : colors.text;
  return (
    <View style={{ height: 9, justifyContent: 'center', position: 'relative' }}>
      <View style={{ height: 3, backgroundColor: colors.surfaceSecondary }}>
        <View
          style={{ width: `${Math.min(1, value) * 100}%`, height: 3, backgroundColor: fillColor }}
        />
      </View>
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: 2,
          height: 9,
          backgroundColor: colors.border,
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          width: 2,
          height: 9,
          backgroundColor: colors.border,
        }}
      />
    </View>
  );
}
