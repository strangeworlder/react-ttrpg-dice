import { describe, it, expect, vi, beforeEach } from 'vitest';
import { instantRoll, instantGroupedRoll } from './instant-roll.js';
import { DieRegistry } from '../registry.js';
import { parseDiceNotation } from '../parser.js';

const registry = new DieRegistry();

// Mock crypto for deterministic tests
function mockCrypto(sequence: number[]): void {
  let idx = 0;
  vi.stubGlobal('crypto', {
    getRandomValues: (buf: Uint32Array) => {
      buf[0] = sequence[idx++ % sequence.length];
      return buf;
    },
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('instantRoll', () => {
  it('returns a result with correct notation', () => {
    const parsed = parseDiceNotation('2d6');
    const result = instantRoll(parsed, registry);

    expect(result.notation).toBe('2d6');
    expect(result.rolls).toHaveLength(2);
    expect(result.total).toBe(result.rolls[0].value + result.rolls[1].value);
  });

  it('all values are within valid range for d20', () => {
    const parsed = parseDiceNotation('1d20');
    for (let i = 0; i < 50; i++) {
      const result = instantRoll(parsed, registry);
      expect(result.rolls[0].value).toBeGreaterThanOrEqual(1);
      expect(result.rolls[0].value).toBeLessThanOrEqual(20);
    }
  });

  it('d10 standalone: face 0 maps to value 10', () => {
    // Mock crypto to return 0 — which selects faceValues[0] = 0 for d10
    mockCrypto([0]);
    const parsed = parseDiceNotation('1d10');
    const result = instantRoll(parsed, registry);

    expect(result.rolls[0].value).toBe(10);
    expect(result.rolls[0].isMax).toBe(true);
    expect(result.rolls[0].type).toBe('d10');
  });

  it('d100 produces values 1–100', () => {
    const parsed = parseDiceNotation('1d100');
    for (let i = 0; i < 100; i++) {
      const result = instantRoll(parsed, registry);
      expect(result.rolls[0].value).toBeGreaterThanOrEqual(1);
      expect(result.rolls[0].value).toBeLessThanOrEqual(100);
      expect(result.rolls[0].type).toBe('d100');
    }
  });

  it('d100 double-zero yields 100', () => {
    // Both tens and ones roll 0
    mockCrypto([0, 0]);
    const parsed = parseDiceNotation('1d100');
    const result = instantRoll(parsed, registry);

    expect(result.rolls[0].value).toBe(100);
    expect(result.rolls[0].isMax).toBe(true);
  });

  it('sets isMin correctly', () => {
    // d20: faceValues = [1,2,...,20], index 0 = value 1
    mockCrypto([0]);
    const parsed = parseDiceNotation('1d20');
    const result = instantRoll(parsed, registry);

    expect(result.rolls[0].isMin).toBe(true);
  });

  it('Fudge dice yield values of -1, 0, or +1', () => {
    const parsed = parseDiceNotation('4dF');
    for (let i = 0; i < 50; i++) {
      const result = instantRoll(parsed, registry);
      for (const r of result.rolls) {
        expect([-1, 0, 1]).toContain(r.value);
        expect(r.type).toBe('dF');
      }
    }
  });

  it('Fudge dice set isMax for +1 and isMin for -1', () => {
    // faceValues = [1, -1, 1, -1, 0, 0]; index 0 → +1, index 1 → -1, index 4 → 0
    mockCrypto([0]);
    expect(instantRoll(parseDiceNotation('1dF'), registry).rolls[0]).toMatchObject({ value: 1, isMax: true, isMin: false });

    mockCrypto([1]);
    expect(instantRoll(parseDiceNotation('1dF'), registry).rolls[0]).toMatchObject({ value: -1, isMax: false, isMin: true });

    mockCrypto([4]);
    expect(instantRoll(parseDiceNotation('1dF'), registry).rolls[0]).toMatchObject({ value: 0, isMax: false, isMin: false });
  });
});

describe('instantGroupedRoll', () => {
  it('returns combined notation', () => {
    const result = instantGroupedRoll([
      { notation: '1d20', label: 'attack' },
      { notation: '2d6', label: 'damage' },
    ], registry);

    expect(result.notation).toBe('1d20 + 2d6');
    expect(result.rolls).toHaveLength(3);
  });

  it('tags results with group labels', () => {
    const result = instantGroupedRoll([
      { notation: '1d20', label: 'attack' },
      { notation: '1d6', label: 'damage' },
    ], registry);

    expect(result.rolls[0].group).toBe('attack');
    expect(result.rolls[1].group).toBe('damage');
  });

  it('total equals sum of all rolls', () => {
    const result = instantGroupedRoll([
      { notation: '2d6' },
      { notation: '1d4' },
    ], registry);

    const sum = result.rolls.reduce((s, r) => s + r.value, 0);
    expect(result.total).toBe(sum);
  });
});
