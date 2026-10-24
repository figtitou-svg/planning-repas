// Libellés de semaine. Les jours sont des chaînes « AAAA-MM-JJ » lues comme des dates UTC,
// comme partout dans l'app (voir week.ts) : aucun décalage de fuseau possible.

const DAY_MS = 86_400_000;

function toDate(day: string): Date {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, date));
}

export function addDays(day: string, days: number): string {
  return new Date(toDate(day).getTime() + days * DAY_MS).toISOString().slice(0, 10);
}

function short(date: Date, withMonth: boolean): string {
  return date.toLocaleDateString("fr-FR", {
    day: "numeric",
    ...(withMonth ? { month: "short" } : {}),
    timeZone: "UTC",
  });
}

/** « 28 sept. – 4 oct. », ou « 21 – 27 sept. » quand la semaine tient dans un seul mois. */
export function formatWeekRange(weekStart: string): string {
  const start = toDate(weekStart);
  const end = toDate(addDays(weekStart, 6));
  const sameMonth = start.getUTCMonth() === end.getUTCMonth();
  return `${short(start, !sameMonth)} – ${short(end, true)}`;
}

/** « Cette semaine », « Semaine prochaine », « Dans 3 semaines »… par rapport à `currentWeekStart`. */
export function relativeWeekLabel(weekStart: string, currentWeekStart: string): string {
  const weeks = Math.round((toDate(weekStart).getTime() - toDate(currentWeekStart).getTime()) / (7 * DAY_MS));
  if (weeks === 0) return "Cette semaine";
  if (weeks === 1) return "Semaine prochaine";
  if (weeks === -1) return "Semaine dernière";
  if (weeks > 1) return `Dans ${weeks} semaines`;
  return `Il y a ${-weeks} semaines`;
}
