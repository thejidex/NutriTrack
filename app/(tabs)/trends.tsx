import React, { useState } from 'react';
import { View } from 'react-native';
import {
  Empty,
  Heading,
  QueryState,
  Row,
  Screen,
  SegmentedControl,
  TextButton,
  Txt,
} from '../../components/ui';
import { Calendar } from '../../components/Calendar';
import { TrendChart } from '../../components/TrendChart';
import { metrics } from '../../components/NutritionView';
import { useApp } from '../../hooks/useApp';
import { useQuery } from '../../hooks/useQuery';
import { dateKey, dateLabel, dateRange, shiftDate } from '../../utils/date';
import { summarize, trendDays } from '../../services/statistics';
import { format } from '../../services/nutrition';
import { Metric } from '../../types/models';
import { s } from '../../i18n/zh-CN';
export default function Trends() {
  const { repo, revision, colors } = useApp();
  const [period, setPeriod] = useState(7);
  const [metric, setMetric] = useState<Metric>('calories');
  const [customStart, setStart] = useState(shiftDate(dateKey(), -6));
  const [customEnd, setEnd] = useState(dateKey());
  const end = period ? dateKey() : customEnd;
  const start = period ? shiftDate(end, 1 - period) : customStart;
  const [calendar, setCalendar] = useState<'start' | 'end' | null>(null);
  const [selected, setSelected] = useState<string>();
  let valid = true;
  try {
    dateRange(start, end);
  } catch {
    valid = false;
  }
  const query = useQuery(
    async () => (valid ? trendDays(start, end, await repo.trend(start, end)) : []),
    [start, end, revision, valid],
    { retainData: true, scope: [start, end, valid] },
  );
  const rows = query.data ?? [];
  const stats = summarize(rows);
  const chosen =
    rows.find((row) => row.date === selected && row.count > 0) ??
    rows.findLast((row) => row.count > 0);
  return (
    <Screen>
      <Heading title={s.trends} />
      <SegmentedControl
        options={[7, 30, 90, 0].map((value, i) => ({
          value,
          label: [s.seven, s.thirty, s.ninety, s.customRange][i],
        }))}
        value={period}
        onChange={(value) => {
          setPeriod(value);
          if (value) {
            setEnd(dateKey());
            setStart(shiftDate(dateKey(), 1 - value));
          }
        }}
      />
      {period === 0 && (
        <View>
          <TextButton title={`${s.start} · ${start}`} onPress={() => setCalendar('start')} />
          <TextButton title={`${s.end} · ${end}`} onPress={() => setCalendar('end')} />
        </View>
      )}
      {!valid && <Txt color={colors.danger}>{s.rangeError}</Txt>}
      <SegmentedControl
        options={metrics.map((value) => ({ value, label: s[value] }))}
        value={metric}
        onChange={setMetric}
      />
      <QueryState
        loading={query.loading && !query.data}
        error={query.error && !query.data}
        retry={query.reload}
      />
      {valid &&
        query.data &&
        !query.error &&
        (stats.count > 0 ? (
          <>
            <Row>
              <Txt muted size={12}>
                {s[metric]} · {metric === 'calories' ? 'kcal' : 'g'}
              </Txt>
              <Txt muted size={11}>
                {start.slice(5)} — {end.slice(5)}
              </Txt>
            </Row>
            <TrendChart
              rows={rows}
              metric={metric}
              selected={chosen?.date}
              onSelect={(row) => setSelected(row.date)}
            />
            {chosen && (
              <View
                testID="trend-selection"
                style={{
                  paddingVertical: 10,
                  gap: 5,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                }}
              >
                <Txt size={13} bold>
                  {dateLabel(chosen.date)}
                </Txt>
                <Txt size={20} bold>
                  {format(chosen.calories)}
                  <Txt size={12} muted>
                    {' '}
                    kcal
                  </Txt>
                </Txt>
                <Txt size={12} muted>
                  {s.protein} {format(chosen.protein, 'protein')}g · {s.carbs}{' '}
                  {format(chosen.carbs, 'carbs')}g · {s.fat} {format(chosen.fat, 'fat')}g
                </Txt>
              </View>
            )}
            <Txt size={15} bold>
              {s.average}
            </Txt>
            <Row style={{ flexWrap: 'wrap' }}>
              {metrics.map((key) => (
                <View key={key} style={{ gap: 4 }}>
                  <Txt muted size={11}>
                    {s[key]}
                  </Txt>
                  <Txt size={14}>
                    {format(stats.average[key], key)} {key === 'calories' ? 'kcal' : 'g'}
                  </Txt>
                </View>
              ))}
            </Row>
            <Row>
              <Txt muted size={12}>
                {s.recordedDays}
              </Txt>
              <Txt size={12}>
                {stats.count} {s.days}
              </Txt>
            </Row>
            <Row>
              <Txt size={12} muted>
                {s.maximum} {format(stats.max!)} kcal
              </Txt>
              <Txt size={12} muted>
                {s.minimum} {format(stats.min!)} kcal
              </Txt>
            </Row>
            <Txt muted size={11}>
              {s.averageHint}
            </Txt>
          </>
        ) : (
          <Empty title={s.noTrend} />
        ))}
      {calendar && (
        <Calendar
          value={calendar === 'start' ? start : end}
          onChange={calendar === 'start' ? setStart : setEnd}
          onClose={() => setCalendar(null)}
        />
      )}
    </Screen>
  );
}
