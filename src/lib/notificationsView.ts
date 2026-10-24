import { isValidDay } from "./expiry";
import type { MissingField } from "./incomplete";

const MISSING_LABELS: Record<MissingField, string> = {
  packageSize: "taille du paquet",
  packagePrice: "prix",
  shelfLifeDays: "durée de conservation",
};

export function badgeText(count: number): string | null {
  const whole = Math.floor(count);
  if (!Number.isFinite(whole) || whole <= 0) return null;
  return whole > 9 ? "9+" : String(whole);
}

export function bellLabel(count: number): string {
  if (badgeText(count) === null) return "Notifications";
  return `Notifications, ${Math.floor(count)} à traiter`;
}

export function expiryStatus(daysLeft: number): string {
  if (daysLeft < 0) return `Périmé depuis ${-daysLeft} j`;
  if (daysLeft === 0) return "Périme aujourd'hui";
  return `Périme dans ${daysLeft} j`;
}

export function formatDay(day: string): string {
  if (!isValidDay(day)) return "";
  const [year, month, date] = day.split("-");
  return `${date}/${month}/${year}`;
}

export function missingText(missing: MissingField[]): string {
  return `Manque : ${missing.map((field) => MISSING_LABELS[field]).join(", ")}`;
}
