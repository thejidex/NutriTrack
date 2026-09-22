import React, { useMemo, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Button, Card, Chip, Field, Heading, QueryState, Row, Screen, Txt } from '../components/ui';
import { useApp } from '../hooks/useApp';
import { useQuery } from '../hooks/useQuery';
import { confirm, useAction } from '../hooks/useAction';
import { Food, FoodUnit, Unit } from '../types/models';
import { numeric, positive } from '../services/nutrition';
import { newId } from '../repositories/AppRepository';
import { s } from '../i18n/zh-CN';

const nutritionFields = [
  'calories',
  'protein',
  'carbs',
  'fat',
  'saturatedFat',
  'fiber',
  'sugar',
  'sodium',
] as const;
const commonUnits = [
  'g',
  'kg',
  'ml',
  'L',
  '个',
  '包',
  '盒',
  '瓶',
  '袋',
  '片',
  '勺',
  '根',
  '杯',
  '份',
];
type EditableUnit = { key: string; unit: string; baseAmount: string };

function blankFood(): Food {
  const now = new Date().toISOString();
  const id = newId();
  return {
    id,
    name: '',
    brand: '',
    baseAmount: 100,
    baseUnit: 'g',
    defaultUnit: 'g',
    gramsPerUnit: 100,
    gramsPerMl: 1,
    units: [
      {
        id: `${id}:unit:0`,
        foodId: id,
        unit: 'g',
        amount: 1,
        baseAmount: 1,
        baseUnit: 'g',
        isDefault: 1,
        sortOrder: 0,
      },
    ],
    calories: null,
    protein: 0,
    carbs: 0,
    fat: 0,
    saturatedFat: 0,
    fiber: 0,
    sugar: 0,
    sodium: 0,
    isCustom: 1,
    isFavorite: 0,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

export default function FoodEdit() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { repo } = useApp();
  const query = useQuery(() => (id ? repo.foods.get(id) : Promise.resolve(blankFood())), [id]);
  return (
    <Screen>
      <Heading
        title={id ? s.edit : s.createFood.replace('＋ ', '')}
        right={<Chip title={s.back} onPress={() => router.back()} />}
      />
      <QueryState loading={query.loading} error={query.error} retry={query.reload} />
      {!query.loading &&
        !query.error &&
        (query.data ? <FoodForm food={query.data} /> : <Txt>{s.missing}</Txt>)}
    </Screen>
  );
}

function FoodForm({ food }: { food: Food }) {
  const { repo, refresh } = useApp();
  const action = useAction();
  const [name, setName] = useState(food.name);
  const [brand, setBrand] = useState(food.brand);
  const [baseAmount, setBaseAmount] = useState(String(food.baseAmount));
  const [basis, setBasis] = useState(food.baseUnit);
  const [unit, setUnit] = useState(food.defaultUnit);
  const [customBasis, setCustomBasis] = useState(
    commonUnits.includes(food.baseUnit) ? '' : food.baseUnit,
  );
  const [extraUnits, setExtraUnits] = useState<EditableUnit[]>(() =>
    food.units
      .filter((candidate) => candidate.unit !== food.baseUnit)
      .map((candidate) => ({
        key: candidate.id,
        unit: candidate.unit,
        baseAmount: String(candidate.baseAmount / candidate.amount),
      })),
  );
  const [values, setValues] = useState(
    () =>
      Object.fromEntries(
        nutritionFields.map((key) => [key, food.name ? String(food[key] ?? '') : '']),
      ) as Record<(typeof nutritionFields)[number], string>,
  );
  const [extended, setExtended] = useState(false);
  const supportedUnits = useMemo(
    () => [basis, ...extraUnits.map((item) => item.unit.trim())].filter(Boolean),
    [basis, extraUnits],
  );

  const chooseBasis = (next: string) => {
    const previous = basis;
    setBasis(next);
    if (unit === previous) setUnit(next);
  };

  async function save() {
    const parsed = Object.fromEntries(
      nutritionFields.map((key) => [
        key,
        numeric(values[key], key !== 'protein' && key !== 'carbs' && key !== 'fat') ??
          (key === 'calories' ? null : 0),
      ]),
    ) as Pick<Food, (typeof nutritionFields)[number]>;
    const cleanBasis = basis.trim();
    const units: FoodUnit[] = [
      {
        id: `${food.id}:unit:0`,
        foodId: food.id,
        unit: cleanBasis,
        amount: 1,
        baseAmount: 1,
        baseUnit: cleanBasis,
        isDefault: unit === cleanBasis ? 1 : 0,
        sortOrder: 0,
      },
      ...extraUnits.map((item, index) => ({
        id: `${food.id}:unit:${index + 1}`,
        foodId: food.id,
        unit: item.unit.trim(),
        amount: 1,
        baseAmount: positive(numeric(item.baseAmount)!),
        baseUnit: cleanBasis,
        isDefault: unit === item.unit.trim() ? 1 : 0,
        sortOrder: index + 1,
      })),
    ];
    const defaultConversion = units.find((candidate) => candidate.unit === unit);
    await repo.saveFood({
      ...food,
      ...parsed,
      name,
      brand,
      baseUnit: cleanBasis,
      baseAmount: positive(numeric(baseAmount)!),
      defaultUnit: unit,
      units,
      // Retained only so old snapshots and older app binaries have conservative values.
      gramsPerUnit:
        cleanBasis === 'g' && defaultConversion ? defaultConversion.baseAmount : food.gramsPerUnit,
      gramsPerMl:
        cleanBasis === 'g' && units.some((candidate) => candidate.unit === 'ml')
          ? units.find((candidate) => candidate.unit === 'ml')!.baseAmount
          : food.gramsPerMl,
    });
    router.back();
    refresh();
  }

  return (
    <>
      <Field label={s.foodName} value={name} onChangeText={setName} maxLength={100} />
      <Field label={s.brandLabel} value={brand} onChangeText={setBrand} maxLength={100} />
      <Txt muted size={13}>
        {s.usualUnit}
      </Txt>
      <Row style={{ flexWrap: 'wrap', justifyContent: 'flex-start' }}>
        {commonUnits.map((candidate) => (
          <Chip
            key={candidate}
            title={candidate}
            selected={basis === candidate}
            onPress={() => {
              setCustomBasis('');
              chooseBasis(candidate);
            }}
          />
        ))}
      </Row>
      <Field
        label={s.otherUnit}
        value={customBasis}
        onChangeText={(value) => {
          setCustomBasis(value);
          if (value.trim()) chooseBasis(value.trim());
        }}
        maxLength={12}
      />
      <Row style={{ justifyContent: 'flex-start' }}>
        <Field
          label={s.nutritionBaseAmount}
          value={baseAmount}
          onChangeText={setBaseAmount}
          keyboardType="decimal-pad"
          style={{ flex: 1 }}
        />
        <Txt bold>{basis}</Txt>
      </Row>
      <Card>
        {nutritionFields.slice(0, 4).map((key) => (
          <Field
            key={key}
            label={key === 'calories' ? s.optionalCalories : `${s[key]} g`}
            value={values[key]}
            onChangeText={(value) => setValues((old) => ({ ...old, [key]: value }))}
            keyboardType="decimal-pad"
          />
        ))}
      </Card>
      <Button title={s.extended} secondary onPress={() => setExtended((value) => !value)} />
      {extended && (
        <Card>
          {nutritionFields.slice(4).map((key) => (
            <Field
              key={key}
              label={`${s[key]} ${key === 'sodium' ? 'mg' : 'g'}`}
              value={values[key]}
              onChangeText={(value) => setValues((old) => ({ ...old, [key]: value }))}
              keyboardType="decimal-pad"
            />
          ))}
        </Card>
      )}
      <Txt bold>{s.commonUnits}</Txt>
      {extraUnits.map((item) => (
        <Card key={item.key}>
          <Field
            label={s.unitName}
            value={item.unit}
            onChangeText={(value) =>
              setExtraUnits((current) =>
                current.map((candidate) =>
                  candidate.key === item.key ? { ...candidate, unit: value } : candidate,
                ),
              )
            }
            maxLength={12}
          />
          <Field
            label={s.unitConversion(item.unit || s.unit, basis)}
            value={item.baseAmount}
            onChangeText={(value) =>
              setExtraUnits((current) =>
                current.map((candidate) =>
                  candidate.key === item.key ? { ...candidate, baseAmount: value } : candidate,
                ),
              )
            }
            keyboardType="decimal-pad"
          />
          <Button
            secondary
            title={s.removeUnit}
            onPress={() => {
              setExtraUnits((current) => current.filter((candidate) => candidate.key !== item.key));
              if (unit === item.unit) setUnit(basis);
            }}
          />
        </Card>
      ))}
      <Button
        secondary
        title={s.addCommonUnit}
        onPress={() =>
          setExtraUnits((current) => [...current, { key: newId(), unit: '', baseAmount: '1' }])
        }
      />
      <Txt muted size={13}>
        {s.defaultUnit}
      </Txt>
      <Row style={{ flexWrap: 'wrap', justifyContent: 'flex-start' }}>
        {supportedUnits.map((candidate) => (
          <Chip
            key={candidate}
            title={candidate}
            selected={unit === candidate}
            onPress={() => setUnit(candidate)}
          />
        ))}
      </Row>
      <Txt muted size={12}>
        {s.foodNote}
      </Txt>
      <Button title={s.save} disabled={action.busy} onPress={() => void action.run(save)} />
      {!!food.name && (
        <Button
          title={s.remove}
          danger
          disabled={action.busy}
          onPress={() =>
            confirm(s.deleteFood, s.deleteFoodHint, () => {
              void action.run(async () => {
                await repo.deleteFood(food.id);
                router.back();
                refresh();
              });
            })
          }
        />
      )}
    </>
  );
}
