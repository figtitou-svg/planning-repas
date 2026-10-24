// Décision horizontal / vertical d'un geste, pour ne jamais bloquer le défilement vertical.

export type GestureLock = "h" | "v";

export const DECIDE_AFTER_PX = 16;
export const GIVE_UP_AFTER_PX = 32;
export const HORIZONTAL_RATIO = 1.5;
export const VERTICAL_DRIFT_MIN_PX = 24;

/**
 * Verrouille un geste horizontal (dominance nette de X) ou vertical.
 * Renvoie null tant que le mouvement est trop court ou trop diagonal pour trancher.
 */
export function lockGesture(absX: number, absY: number): GestureLock | null {
  const total = Math.hypot(absX, absY);
  if (total < DECIDE_AFTER_PX) return null;
  if (absX > HORIZONTAL_RATIO * absY) return "h";
  if (absY > absX) return "v";
  // Diagonale ambiguë : on tranche pour le vertical si le mouvement continue.
  return total >= GIVE_UP_AFTER_PX ? "v" : null;
}

/** Un geste verrouillé horizontal qui devient nettement vertical doit rendre la carte. */
export function isClearlyVertical(absX: number, absY: number): boolean {
  return absY > HORIZONTAL_RATIO * absX && absY > VERTICAL_DRIFT_MIN_PX;
}
