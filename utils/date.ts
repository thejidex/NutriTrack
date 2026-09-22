export function dateKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function parseDate(key: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) throw new Error('Invalid date');
  const [y, m, d] = key.split('-').map(Number);
  const value = new Date(y, m - 1, d, 12);
  if (dateKey(value) !== key) throw new Error('Invalid date');
  return value;
}
export function shiftDate(key: string, delta: number): string {
  const d = parseDate(key);
  d.setDate(d.getDate() + delta);
  return dateKey(d);
}
export function dateRange(start: string, end: string): string[] {
  parseDate(start);
  parseDate(end);
  if (start > end) throw new Error('Invalid range');
  const days: string[] = [];
  for (let d = start; d <= end; d = shiftDate(d, 1)) {
    if (days.length >= 366) throw new Error('Range too long');
    days.push(d);
  }
  return days;
}
export function dateLabel(key: string): string {
  const d = parseDate(key);
  return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日`;
}
export function shortDate(key: string): string {
  const d = parseDate(key);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
