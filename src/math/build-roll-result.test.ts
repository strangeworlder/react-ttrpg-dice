import { describe, it, expect } from 'vitest';
import { buildRollResult, buildPredeterminedRollResult } from './build-roll-result.js';
import { DieRegistry } from '../registry.js';
import type { ExpandedDie } from '../types.js';

const registry = new DieRegistry();

// Helper to build an ExpandedDie for testing
function die(id: string, registryId: string, publicType: string, opts: Partial<ExpandedDie> = {}): ExpandedDie {
  return { id, registryId: registryId as ExpandedDie['registryId'], publicType: publicType as ExpandedDie['publicType'], ...opts };
}

describe('buildRollResult', () => {
  it('builds a simple d6 result', () => {
    const expanded = [die('d6-1', 'd6', 'd6'), die('d6-2', 'd6', 'd6')];
    const resolved = new Map([['d6-1', 3], ['d6-2', 5]]);
    const result = buildRollResult('2d6', expanded, resolved, registry);

    expect(result.notation).toBe('2d6');
    expect(result.total).toBe(8);
    expect(result.rolls).toHaveLength(2);
    expect(result.rolls[0].value).toBe(3);
    expect(result.rolls[1].value).toBe(5);
  });

  it('remaps d10 face 0 to value 10', () => {
    const expanded = [die('d10-1', 'd10', 'd10')];
    const resolved = new Map([['d10-1', 0]]);
    const result = buildRollResult('1d10', expanded, resolved, registry);

    expect(result.rolls[0].value).toBe(10);
    expect(result.rolls[0].isMax).toBe(true);
  });

  it('handles d100 pair', () => {
    const expanded = [
      die('t1', 'd10-tens', 'd100', { pairId: 'p1', isTens: true }),
      die('o1', 'd10', 'd100', { pairId: 'p1', isTens: false }),
    ];
    const resolved = new Map([['t1', 70], ['o1', 3]]);
    const result = buildRollResult('1d100', expanded, resolved, registry);

    expect(result.rolls).toHaveLength(1);
    expect(result.rolls[0].value).toBe(73);
    expect(result.rolls[0].type).toBe('d100');
  });

  it('d100 double zero = 100', () => {
    const expanded = [
      die('t1', 'd10-tens', 'd100', { pairId: 'p1', isTens: true }),
      die('o1', 'd10', 'd100', { pairId: 'p1', isTens: false }),
    ];
    const resolved = new Map([['t1', 0], ['o1', 0]]);
    const result = buildRollResult('1d100', expanded, resolved, registry);

    expect(result.rolls[0].value).toBe(100);
    expect(result.rolls[0].isMax).toBe(true);
  });

  it('preserves group labels', () => {
    const expanded = [die('d6-1', 'd6', 'd6', { group: 'damage' })];
    const resolved = new Map([['d6-1', 4]]);
    const result = buildRollResult('1d6', expanded, resolved, registry);

    expect(result.rolls[0].group).toBe('damage');
  });

  it('isMin is true when value = 1', () => {
    const expanded = [die('d20-1', 'd20', 'd20')];
    const resolved = new Map([['d20-1', 1]]);
    const result = buildRollResult('1d20', expanded, resolved, registry);

    expect(result.rolls[0].isMin).toBe(true);
    expect(result.rolls[0].isMax).toBe(false);
  });
});

describe('buildPredeterminedRollResult', () => {
  it('uses predetermined values directly', () => {
    const expanded = [die('d20-1', 'd20', 'd20'), die('d6-1', 'd6', 'd6')];
    const result = buildPredeterminedRollResult('1d20 + 1d6', expanded, [17, 4], registry);

    expect(result.rolls[0].value).toBe(17);
    expect(result.rolls[1].value).toBe(4);
    expect(result.total).toBe(21);
  });

  it('handles d100 as single entry', () => {
    const expanded = [
      die('t1', 'd10-tens', 'd100', { pairId: 'p1', isTens: true }),
      die('o1', 'd10', 'd100', { pairId: 'p1', isTens: false }),
    ];
    const result = buildPredeterminedRollResult('1d100', expanded, [73], registry);

    expect(result.rolls).toHaveLength(1);
    expect(result.rolls[0].value).toBe(73);
    expect(result.rolls[0].type).toBe('d100');
    expect(result.total).toBe(73);
  });

  it('defaults missing values to 1', () => {
    const expanded = [die('d6-1', 'd6', 'd6')];
    const result = buildPredeterminedRollResult('1d6', expanded, [], registry);

    expect(result.rolls[0].value).toBe(1);
  });
});
