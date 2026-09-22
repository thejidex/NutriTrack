import React, { useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Button, Card, Chip, Field, Heading, QueryState, Row, Screen, Txt } from '../components/ui';
import { NutritionView } from '../components/NutritionView';
import { useApp } from '../hooks/useApp';
import { useQuery } from '../hooks/useQuery';
import { useAction } from '../hooks/useAction';
import { calculate, normalizeFood, numeric } from '../services/nutrition';
import { Food, FoodEntry, MealType, Unit } from '../types/models';
import { dateLabel } from '../utils/date';
import { s } from '../i18n/zh-CN';
export default function EntryScreen() {
  const params = useLocalSearchParams<{
    foodId?: string;
    entryId?: string;
    mealId?: string;
    date?: string;
    initialAmount?: string;
    initialUnit?: Unit;
  }>();
  const { repo } = useApp();
  const query = useQuery(async () => {
    const entry = params.entryId ? await repo.entry(params.entryId) : null;
    const food = entry
      ? normalizeFood(JSON.parse(entry.foodSnapshot) as Food)
      : params.foodId
        ? await repo.foods.get(params.foodId)
        : null;
    const meals = await repo.meals(true);
    return { entry, food, meals };
  }, [params.foodId, params.entryId]);
  return (
    <Screen>
      <Heading
        title={params.entryId ? s.editEntry : s.addFood.replace('＋ ', '')}
        right={<Chip title={s.back} onPress={() => router.back()} />}
      />
      <QueryState loading={query.loading} error={query.error} retry={query.reload} />
      {!query.loading &&
        !query.error &&
        (query.data?.food ? (
          <EntryForm
            food={query.data.food}
            entry={query.data.entry}
            meals={query.data.meals}
            mealId={params.mealId}
            date={params.date}
            initialAmount={params.initialAmount}
            initialUnit={params.initialUnit}
          />
        ) : (
          <Txt>{s.missing}</Txt>
        ))}
    </Screen>
  );
}
function EntryForm({
  food,
  entry,
  meals,
  mealId,
  date: routeDate,
  initialAmount,
  initialUnit,
}: {
  food: Food;
  entry: FoodEntry | null;
  meals: MealType[];
  mealId?: string;
  date?: string;
  initialAmount?: string;
  initialUnit?: Unit;
}) {
  const { repo, date: selectedDate, refresh } = useApp();
  const action = useAction();
  const supportedUnits = food.units.map((candidate) => candidate.unit);
  const initialSupportedUnit =
    initialUnit && supportedUnits.includes(initialUnit) ? initialUnit : food.defaultUnit;
  const [amount, setAmount] = useState(
    String(
      entry?.amount ??
        (initialAmount && Number(initialAmount) > 0
          ? initialAmount
          : food.defaultUnit === food.baseUnit
            ? food.baseAmount
            : 1),
    ),
  );
  const [unit, setUnit] = useState<Unit>(entry?.unit ?? initialSupportedUnit);
  const [meal, setMeal] = useState(
    entry?.mealTypeId ?? mealId ?? meals.find((m) => !m.deletedAt)?.id ?? '',
  );
  const date = entry?.date ?? routeDate ?? selectedDate;
  let nutrition: ReturnType<typeof calculate> | null = null;
  try {
    nutrition = calculate(food, numeric(amount)!, unit);
  } catch {
    /* Inline validation below. */
  }
  return (
    <>
      <View style={{ gap: 3 }}>
        <Txt size={20} bold>
          {food.name}
        </Txt>
        <Txt muted size={13}>
          {food.brand || (food.isCustom ? s.custom : s.demo)}
        </Txt>
        <Txt size={12} muted>
          {s.selectedDate} · {dateLabel(date)}
        </Txt>
      </View>
      <Field
        label={s.amount}
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
        selectTextOnFocus
      />
      {!entry && initialAmount && initialUnit && (
        <Txt size={12} muted>
          {s.reusedAmount}
        </Txt>
      )}
      <Row style={{ flexWrap: 'wrap', justifyContent: 'flex-start' }}>
        {food.units.map(({ unit: candidate }) => (
          <Chip
            key={candidate}
            title={candidate}
            selected={unit === candidate}
            onPress={() => setUnit(candidate)}
          />
        ))}
      </Row>
      <Txt size={12} muted>
        {food.units
          .filter((candidate) => candidate.unit !== food.baseUnit)
          .map(
            (candidate) =>
              `${candidate.amount}${candidate.unit} = ${candidate.baseAmount}${candidate.baseUnit}`,
          )
          .join(' · ') || s.baseUnitOnly(food.baseUnit)}
      </Txt>
      <View style={{ gap: 10 }}>
        <Txt muted size={13}>
          {s.meal}
        </Txt>
        <Row style={{ flexWrap: 'wrap', justifyContent: 'flex-start' }}>
          {meals
            .filter((m) => !m.deletedAt || m.id === entry?.mealTypeId)
            .map((m) => (
              <Chip
                key={m.id}
                title={m.name + (m.deletedAt ? s.archived : '')}
                selected={meal === m.id}
                onPress={() => setMeal(m.id)}
              />
            ))}
        </Row>
      </View>
      {!meals.some((candidate) => !candidate.deletedAt) && !entry && (
        <Card>
          <Txt>{s.noMeals}</Txt>
          <Button title={s.createMeal} secondary onPress={() => router.push('/meals')} />
        </Card>
      )}
      {nutrition ? (
        <>
          <NutritionView value={nutrition} />
          <Txt size={12} muted>
            {nutrition.calorieSource === 'provided' ? s.provided : s.estimated}
          </Txt>
        </>
      ) : (
        <Txt>{s.invalidAmount}</Txt>
      )}
      {entry && (
        <Txt size={12} muted>
          {s.snapshotHint}
        </Txt>
      )}
      <Button
        title={entry ? s.save : s.addTo(meals.find((m) => m.id === meal)?.name ?? '')}
        disabled={
          !nutrition ||
          !meal ||
          action.busy ||
          (!entry && !meals.some((candidate) => !candidate.deletedAt))
        }
        onPress={() => {
          void action.run(async () => {
            if (entry) await repo.updateEntry(entry, numeric(amount)!, unit, meal);
            else await repo.addEntry(food, meal, date, numeric(amount)!, unit);
            router.dismissTo('/');
            refresh();
          });
        }}
      />
      {entry && (
        <Button
          danger
          title={s.remove}
          disabled={action.busy}
          onPress={() => {
            void action.run(async () => {
              await repo.deleteEntry(entry.id);
              router.dismissTo('/');
              refresh();
            });
          }}
        />
      )}
    </>
  );
}
