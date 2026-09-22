import React, { useState } from 'react';
import { router } from 'expo-router';
import { Button, Card, Chip, Field, Heading, QueryState, Screen, Txt } from '../components/ui';
import { metrics } from '../components/NutritionView';
import { useApp } from '../hooks/useApp';
import { useQuery } from '../hooks/useQuery';
import { useAction } from '../hooks/useAction';
import { Goals } from '../types/models';
import { numeric, positive } from '../services/nutrition';
import { s } from '../i18n/zh-CN';
export default function GoalsScreen() {
  const { repo } = useApp();
  const q = useQuery(() => repo.goals(), []);
  return (
    <Screen>
      <Heading title={s.goals} right={<Chip title={s.back} onPress={() => router.back()} />} />
      <Txt muted>{s.goalsHint}</Txt>
      <QueryState loading={q.loading} error={q.error} retry={q.reload} />
      {q.data && !q.loading && <GoalForm goals={q.data} />}
    </Screen>
  );
}
function GoalForm({ goals }: { goals: Goals }) {
  const { repo, refresh } = useApp();
  const action = useAction();
  const [values, setValues] = useState(() =>
    Object.fromEntries(metrics.map((k) => [k, String(goals[k] ?? '')])),
  );
  return (
    <>
      <Card>
        {metrics.map((k) => (
          <Field
            key={k}
            label={`${s[k]} ${k === 'calories' ? 'kcal' : 'g'}`}
            value={values[k]}
            onChangeText={(v) => setValues((old) => ({ ...old, [k]: v }))}
            keyboardType="decimal-pad"
          />
        ))}
      </Card>
      <Button
        title={s.save}
        disabled={action.busy}
        onPress={() => {
          void action.run(async () => {
            const next: Goals = {};
            for (const k of metrics) {
              const value = numeric(values[k], true);
              if (value !== null) next[k] = positive(value);
            }
            await repo.setGoals(next);
            router.back();
            refresh();
          });
        }}
      />
    </>
  );
}
