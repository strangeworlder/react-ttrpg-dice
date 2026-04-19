export interface ThrowImpulse {
  linear:  [number, number, number];
  angular: [number, number, number];
}

/**
 * Generates a random throw impulse for one die.
 * Scaled by mass so heavy dice (D20) roll further than light ones (D4).
 */
export function calculateThrowImpulse(mass: number): ThrowImpulse {
  const s = mass * 2; // reduced from ×3 — keeps velocity within CCD safe range
  const rand = () => (Math.random() - 0.5) * 12;
  return {
    linear:  [(Math.random() - 0.5) * s * 0.3, -s * 1.2, (Math.random() - 0.5) * s * 0.3],
    angular: [rand(), rand(), rand()],
  };
}
