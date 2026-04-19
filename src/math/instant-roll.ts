import type { ParsedNotation, RollResult, SingleDieResult } from '../types.js';
import type { DieRegistry } from '../registry.js';

function secureRandInt(max: number): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] % max;
}

/**
 * Math-only instant roll — no 3D physics.
 * Used when prefers-reduced-motion is active.
 */
export function instantRoll(parsed: ParsedNotation, registry: DieRegistry): RollResult {
  const rolls: SingleDieResult[] = [];

  for (const group of parsed.groups) {
    for (let i = 0; i < group.count; i++) {
      if (group.type === 'd100') {
        const tens = secureRandInt(10) * 10;
        const ones = secureRandInt(10);
        const value = tens + ones === 0 ? 100 : tens + ones;
        rolls.push({ type: 'd100', value, isMax: value === 100, isMin: value === 1 });
      } else {
        const def = registry.get(group.type);
        const fi = secureRandInt(def.sides);
        const raw = def.faceValues[fi] ?? fi + 1;
        // D10 standalone: face "0" = 10
        const value = group.type === 'd10' && raw === 0 ? 10 : raw;
        rolls.push({ type: group.type, value, isMax: value === def.sides, isMin: value === 1 });
      }
    }
  }

  return { notation: parsed.raw, total: rolls.reduce((s, r) => s + r.value, 0), rolls };
}
