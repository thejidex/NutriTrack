import { DayTotal, Metric } from '../types/models';
import { dateRange } from '../utils/date';
import { sumNutrition, zeroNutrition } from './nutrition';
export function trendDays(start: string, end: string, rows: DayTotal[]): DayTotal[] {
  const map = new Map(rows.map((row) => [row.date, row]));
  return dateRange(start, end).map(
    (date) => map.get(date) ?? { ...zeroNutrition(), date, count: 0 },
  );
}
export function summarize(rows: DayTotal[]) {
  const recorded = rows.filter((r) => r.count > 0);
  const totals = sumNutrition(recorded);
  const average = { ...totals };
  for (const key of Object.keys(average) as (keyof typeof average)[])
    average[key] /= recorded.length || 1;
  return {
    average,
    count: recorded.length,
    max: recorded.length ? Math.max(...recorded.map((r) => r.calories)) : null,
    min: recorded.length ? Math.min(...recorded.map((r) => r.calories)) : null,
  };
}
export function chartSegments(rows: DayTotal[], metric: Metric, width: number, height: number) {
  const max = Math.max(1, ...rows.map((r) => r[metric])) * 1.15;
  const points = rows.map((r, i) => ({
    x: 42 + (i * (width - 58)) / Math.max(1, rows.length - 1),
    y: 18 + (1 - r[metric] / max) * (height - 52),
    row: r,
  }));
  const segments: (typeof points)[] = [];
  let current: typeof points = [];
  for (const p of points) {
    if (p.row.count) current.push(p);
    else if (current.length) {
      segments.push(current);
      current = [];
    }
  }
  if (current.length) segments.push(current);
  return { max, points, segments };
}
