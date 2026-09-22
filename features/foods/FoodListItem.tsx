import React from 'react';
import { Pressable, View } from 'react-native';
import { FoodSearchResult } from '../../types/models';
import { calculate, format } from '../../services/nutrition';
import { useApp } from '../../hooks/useApp';
import { Row, Txt, TextButton } from '../../components/ui';
import { s } from '../../i18n/zh-CN';
export function FoodListItem({
  result,
  onOpen,
  onDetails,
  onFavorite,
  onEdit,
  onDelete,
  busy,
  picking = false,
}: {
  result: FoodSearchResult;
  onOpen: () => void;
  onDetails: () => void;
  onFavorite: () => void;
  onEdit: () => void;
  onDelete: () => void;
  busy: boolean;
  picking?: boolean;
}) {
  const { colors } = useApp();
  const { food, lastAmount, lastUnit } = result;
  const n = calculate(food, food.baseAmount, food.baseUnit);
  return (
    <View
      testID="food-list-item"
      style={{
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 6,
        marginBottom: 5,
        overflow: 'hidden',
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={food.name}
        onPress={onOpen}
        style={({ pressed }) => ({
          minHeight: 50,
          justifyContent: 'center',
          opacity: pressed ? 0.62 : 1,
        })}
      >
        <View style={{ paddingRight: picking ? 90 : 126 }}>
          <Txt size={14} bold>
            {food.name}
          </Txt>
          <Txt size={11} muted>
            {format(n.calories)} kcal / {food.baseAmount}
            {food.baseUnit}
            {lastAmount != null && lastUnit != null ? ` · ${lastAmount}${lastUnit}` : ''}
            {food.brand ? ` · ${food.brand}` : ''}
          </Txt>
          <Txt size={11} muted>
            {s.protein} {format(n.protein, 'protein')}g · {s.carbs} {format(n.carbs, 'carbs')}g ·{' '}
            {s.fat} {format(n.fat, 'fat')}g
          </Txt>
        </View>
      </Pressable>
      <Row
        style={{
          position: 'absolute',
          right: 5,
          top: 5,
          gap: 4,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${food.isFavorite ? s.unfavorite : s.favorite} ${food.name}`}
          disabled={busy}
          onPress={onFavorite}
          style={({ pressed }) => ({
            width: 34,
            minHeight: 40,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: busy ? 0.4 : pressed ? 0.6 : 1,
          })}
        >
          <Txt size={20} color={food.isFavorite ? colors.text : colors.textSecondary}>
            {food.isFavorite ? '★' : '☆'}
          </Txt>
        </Pressable>
        {picking ? (
          <TextButton title="›" label={`${s.foodDetails} ${food.name}`} onPress={onDetails} />
        ) : (
          <>
            <TextButton
              boxed
              compact
              title={s.edit}
              label={`${s.edit} ${food.name}`}
              onPress={onEdit}
            />
            <TextButton
              boxed
              compact
              title={s.remove}
              label={`${s.remove} ${food.name}`}
              color={colors.danger}
              borderColor={colors.danger}
              onPress={onDelete}
              disabled={busy}
            />
          </>
        )}
      </Row>
    </View>
  );
}
