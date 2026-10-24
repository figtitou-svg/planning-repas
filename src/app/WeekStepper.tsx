"use client";

import { addDays, formatWeekRange, relativeWeekLabel } from "@/lib/weekLabel";
import { localCalendarDateAsUtc, mondayOf } from "@/lib/week";
import { Icon } from "./Icon";

/** Sélecteur de semaine : ‹ Semaine prochaine · 28 sept. – 4 oct. › (remplace le champ date, qui ramenait silencieusement au lundi). */
export function WeekStepper({
  week,
  onChange,
}: {
  week: string;
  onChange: (week: string) => void;
}) {
  const currentWeek = mondayOf(localCalendarDateAsUtc(new Date()));
  return (
    <div className="week-stepper">
      <button
        type="button"
        className="icon-btn"
        aria-label="Semaine précédente"
        disabled={!week}
        onClick={() => onChange(addDays(week, -7))}
      >
        <Icon name="chevron-left" />
      </button>
      <p className="week-stepper-label" aria-live="polite">
        {week ? (
          <>
            <span className="week-stepper-when">{relativeWeekLabel(week, currentWeek)}</span>
            <span className="week-stepper-range">{formatWeekRange(week)}</span>
          </>
        ) : (
          <span className="week-stepper-range">…</span>
        )}
      </p>
      <button
        type="button"
        className="icon-btn"
        aria-label="Semaine suivante"
        disabled={!week}
        onClick={() => onChange(addDays(week, 7))}
      >
        <Icon name="chevron-right" />
      </button>
    </div>
  );
}
