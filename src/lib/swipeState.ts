// Logique pure du swipe « révélation » : distance, seuil de déclenchement, direction.

export type SwipeDirection = "left" | "right";

export interface SwipeState {
  /** Sens dans lequel la carte est tirée (null si immobile). */
  direction: SwipeDirection | null;
  /** Distance absolue parcourue, en px. */
  distance: number;
  /** Seuil à dépasser pour déclencher l'action, en px. */
  threshold: number;
  /** Progression vers le seuil, entre 0 et 1. */
  progress: number;
  /** Vrai quand le relâchement déclencherait l'action. */
  armed: boolean;
}

export const MAX_THRESHOLD_PX = 96;
export const THRESHOLD_RATIO = 0.35;

/** Seuil : le plus petit de 96 px et 35 % de la largeur (96 px si la largeur est inconnue). */
export function swipeThreshold(width: number): number {
  if (!Number.isFinite(width) || width <= 0) return MAX_THRESHOLD_PX;
  return Math.min(MAX_THRESHOLD_PX, width * THRESHOLD_RATIO);
}

export function swipeState(deltaX: number, width: number): SwipeState {
  const threshold = swipeThreshold(width);
  const distance = Number.isFinite(deltaX) ? Math.abs(deltaX) : 0;
  const direction: SwipeDirection | null = deltaX > 0 ? "right" : deltaX < 0 ? "left" : null;
  return {
    direction,
    distance,
    threshold,
    progress: Math.min(1, distance / threshold),
    armed: direction !== null && distance >= threshold,
  };
}
