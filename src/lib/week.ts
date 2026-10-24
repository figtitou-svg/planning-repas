export function mondayOf(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

export function nextWeekStart(today: Date): string {
  const monday = mondayOf(today);
  const d = new Date(Date.UTC(
    parseInt(monday.slice(0, 4)),
    parseInt(monday.slice(5, 7)) - 1,
    parseInt(monday.slice(8, 10))
  ));
  d.setUTCDate(d.getUTCDate() + 7);
  return d.toISOString().slice(0, 10);
}

/**
 * Reinterprets a Date's LOCAL calendar day (getFullYear/getMonth/getDate) as a
 * UTC-midnight Date. mondayOf() reads UTC calendar fields, so calling it directly
 * on `new Date()` (the current local moment) can return the wrong Monday near
 * midnight in timezones ahead of UTC (e.g. a French user at 00:30 on a Monday
 * would still see Sunday's UTC date, and get last week's Monday). Passing the
 * result of this function to mondayOf() instead makes the "week" follow the
 * viewer's local calendar day.
 */
export function localCalendarDateAsUtc(date: Date): Date {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
}

export function localTodayString(now: Date = new Date()): string {
  return localCalendarDateAsUtc(now).toISOString().slice(0, 10);
}
