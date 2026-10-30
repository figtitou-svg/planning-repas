const MAX_STEPS = 100;

/** `steps` est facultatif ; s'il est fourni, ce doit être une liste raisonnable de textes. */
export function invalidSteps(steps: unknown): boolean {
  if (steps === undefined) return false;
  return (
    !Array.isArray(steps) ||
    steps.length > MAX_STEPS ||
    steps.some((step) => typeof step !== "string")
  );
}
