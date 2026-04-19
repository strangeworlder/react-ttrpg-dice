import type { ExpandedDie, RollResult, SingleDieResult } from '../types.js';
import type { DieRegistry } from '../registry.js';
import { readD100 } from './read-d100.js';

/**
 * Assembles the final RollResult from a map of per-die resolved values.
 * Handles d100 pair grouping and D10 standalone "0 = 10" remapping.
 */
export function buildRollResult(
  notation: string,
  expandedDice: ExpandedDie[],
  resolvedValues: Map<string, number>,
  registry: DieRegistry,
): RollResult {
  const rolls: SingleDieResult[] = [];
  const processedPairs = new Set<string>();

  for (const die of expandedDice) {
    const value = resolvedValues.get(die.id);
    if (value === undefined) continue;

    if (die.pairId) {
      if (processedPairs.has(die.pairId)) continue;
      processedPairs.add(die.pairId);

      const tensD = expandedDice.find(d => d.pairId === die.pairId && d.isTens);
      const onesD = expandedDice.find(d => d.pairId === die.pairId && !d.isTens);
      const tens  = tensD ? (resolvedValues.get(tensD.id) ?? 0) : 0;
      const ones  = onesD ? (resolvedValues.get(onesD.id) ?? 0) : 0;
      const d100  = readD100(tens, ones);
      rolls.push({ type: 'd100', value: d100, isMax: d100 === 100, isMin: d100 === 1, group: die.group });
    } else {
      const def    = registry.get(die.registryId);
      const actual = die.registryId === 'd10' && value === 0 ? 10 : value;
      rolls.push({ type: die.publicType, value: actual, isMax: actual === def.sides, isMin: actual === 1, group: die.group });
    }
  }

  return { notation, total: rolls.reduce((s, r) => s + r.value, 0), rolls };
}
