export interface SpawnPosition {
  position: [number, number, number];
  rotation: [number, number, number]; // Euler XYZ
}

/**
 * Calculates staggered spawn positions for N dice above the scene.
 * Dice are spread in a grid so their colliders don't overlap on frame 1
 * (prevents the "physics explosion" edge case).
 *
 * @param count       - Number of dice
 * @param worldHalfX  - Half the viewport width in world units
 */
export function calculateSpawnPositions(count: number, worldHalfX: number): SpawnPosition[] {
  const cols    = Math.ceil(Math.sqrt(count));
  const spacing = Math.min(2.0, (worldHalfX * 1.6) / Math.max(cols, 1));
  const halfW   = ((cols - 1) * spacing) / 2;
  const jit     = () => (Math.random() - 0.5) * 0.3;

  return Array.from({ length: count }, (_, i) => ({
    position: [
      (i % cols) * spacing - halfW + jit(),
      8 + Math.floor(i / cols) * 0.6 + Math.random() * 1.5,
      jit(),
    ] as [number, number, number],
    rotation: [
      Math.random() * Math.PI * 2,
      Math.random() * Math.PI * 2,
      Math.random() * Math.PI * 2,
    ] as [number, number, number],
  }));
}
