/**
 * Combines d100 tens + ones into a single result.
 * Convention: 00 + 0 = 100 (not 0).
 *
 * @param tensValue – result from d10-tens (0, 10, 20, …, 90)
 * @param onesValue – result from d10-ones (0, 1, …, 9)
 */
export function readD100(tensValue: number, onesValue: number): number {
  const combined = tensValue + onesValue;
  return combined === 0 ? 100 : combined;
}
