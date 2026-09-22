import React, { useState } from 'react';
import { router } from 'expo-router';
import { Button, Card, Chip, Field, Heading, QueryState, Row, Screen, Txt } from '../components/ui';
import { useApp } from '../hooks/useApp';
import { useQuery } from '../hooks/useQuery';
import { confirm, useAction } from '../hooks/useAction';
import { s } from '../i18n/zh-CN';
export default function MealsScreen() {
  const { repo, revision, refresh } = useApp();
  const q = useQuery(() => repo.meals(), [revision], { retainData: true, scope: 'meals' });
  const action = useAction();
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<string>();
  const reorder = (index: number, direction: number) => {
    void action.run(async () => {
      const ids = q.data!.map((m) => m.id);
      [ids[index], ids[index + direction]] = [ids[index + direction], ids[index]];
      await repo.reorder(ids);
      refresh();
    });
  };
  return (
    <Screen>
      <Heading title={s.meals} right={<Chip title={s.back} onPress={() => router.back()} />} />
      <QueryState loading={q.loading && !q.data} error={q.error && !q.data} retry={q.reload} />
      <Card>
        <Field
          label={editing ? s.rename : s.newMeal}
          value={name}
          onChangeText={setName}
          maxLength={30}
        />
        <Button
          title={editing ? s.save : s.addMeal}
          disabled={action.busy}
          onPress={() => {
            void action.run(async () => {
              await repo.saveMeal(name, editing);
              setName('');
              setEditing(undefined);
              refresh();
            });
          }}
        />
        {editing && (
          <Button
            secondary
            title={s.cancel}
            onPress={() => {
              setEditing(undefined);
              setName('');
            }}
          />
        )}
      </Card>
      {q.data?.map((meal, i) => (
        <Card key={meal.id}>
          <Row>
            <Txt size={18} bold>
              {meal.name}
            </Txt>
            <Chip
              title={s.rename}
              onPress={() => {
                setEditing(meal.id);
                setName(meal.name);
              }}
            />
          </Row>
          <Row style={{ flexWrap: 'wrap', justifyContent: 'flex-start' }}>
            {i > 0 && <Chip title={s.up} onPress={() => reorder(i, -1)} />}
            {i < q.data!.length - 1 && <Chip title={s.down} onPress={() => reorder(i, 1)} />}
            <Chip
              title={s.remove}
              onPress={() =>
                confirm(s.deleteMeal, s.deleteMealHint, () => {
                  void action.run(async () => {
                    await repo.deleteMeal(meal.id);
                    if (editing === meal.id) {
                      setEditing(undefined);
                      setName('');
                    }
                    refresh();
                  });
                })
              }
            />
          </Row>
        </Card>
      ))}
    </Screen>
  );
}
