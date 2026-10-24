export const EXPIRY_ALERT_DAYS = 3;
const MAX_SHELF_LIFE_DAYS = 36_500;
const DAY_MS = 86_400_000;
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function parseDay(day: string): number {
  const [year, month, date] = day.split("-").map(Number);
  return Date.UTC(year, month - 1, date);
}

export function isValidDay(day: string): boolean {
  if (!DAY_PATTERN.test(day)) return false;
  const time = parseDay(day);
  return new Date(time).toISOString().slice(0, 10) === day;
}

export function toDay(value: string): string | null {
  const day = value.slice(0, 10);
  return isValidDay(day) ? day : null;
}

export function expiryDay(purchaseDate: string, shelfLifeDays: number): string | null {
  if (!isValidDay(purchaseDate)) return null;
  if (!Number.isFinite(shelfLifeDays) || Math.abs(shelfLifeDays) > MAX_SHELF_LIFE_DAYS) return null;
  return new Date(parseDay(purchaseDate) + shelfLifeDays * DAY_MS).toISOString().slice(0, 10);
}

export function daysBetween(fromDay: string, toDay: string): number {
  return Math.round((parseDay(toDay) - parseDay(fromDay)) / DAY_MS);
}
