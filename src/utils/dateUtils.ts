/**
 * Utility functions for handling weekly dated meal plans and grocery lists.
 */

export function getMondayOfWeek(d: Date = new Date()): string {
  const date = new Date(d);
  const day = date.getDay();
  // day 0 is Sunday, 1 is Monday...
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(date.setDate(diff));
  return monday.toISOString().split('T')[0];
}

export function formatWeekRange(weekStartDateStr: string): string {
  if (!weekStartDateStr) return 'Current Week';
  const [y, m, d] = weekStartDateStr.split('-').map(Number);
  const start = new Date(y, m - 1, d);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  const startMonth = start.toLocaleDateString('en-US', { month: 'short' });
  const endMonth = end.toLocaleDateString('en-US', { month: 'short' });

  if (startMonth === endMonth) {
    return `${startMonth} ${start.getDate()} – ${end.getDate()}, ${start.getFullYear()}`;
  }
  return `${startMonth} ${start.getDate()} – ${endMonth} ${end.getDate()}, ${start.getFullYear()}`;
}

export function getAdjacentWeek(weekStartDateStr: string, offsetWeeks: number): string {
  const [y, m, d] = weekStartDateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + offsetWeeks * 7);
  return date.toISOString().split('T')[0];
}

export function isCurrentWeek(weekStartDateStr: string): boolean {
  return weekStartDateStr === getMondayOfWeek();
}
