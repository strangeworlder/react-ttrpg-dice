import { describe, it, expect } from 'vitest';
import { parseDiceNotation, expandNotation, DiceNotationError } from './parser.js';

describe('parseDiceNotation', () => {
  it('parses single die', () => {
    const r = parseDiceNotation('1d20');
    expect(r.groups).toHaveLength(1);
    expect(r.groups[0]).toEqual({ count: 1, type: 'd20' });
    expect(r.raw).toBe('1d20');
  });

  it('defaults count to 1 when omitted', () => {
    expect(parseDiceNotation('d20').groups[0].count).toBe(1);
  });

  it('is case-insensitive', () => {
    expect(parseDiceNotation('2D6').groups[0].type).toBe('d6');
  });

  it('parses multiple groups', () => {
    const r = parseDiceNotation('2d6 + 1d4');
    expect(r.groups).toHaveLength(2);
    expect(r.groups[0]).toEqual({ count: 2, type: 'd6' });
    expect(r.groups[1]).toEqual({ count: 1, type: 'd4' });
  });

  it('parses all valid die types', () => {
    for (const t of ['d4','d6','d8','d10','d12','d20','d100']) {
      expect(() => parseDiceNotation(`1${t}`)).not.toThrow();
    }
  });

  it('throws for invalid die type', () => {
    expect(() => parseDiceNotation('1d7')).toThrow(DiceNotationError);
  });

  it('throws for empty string', () => {
    expect(() => parseDiceNotation('')).toThrow(DiceNotationError);
  });

  it('throws for count > MAX', () => {
    expect(() => parseDiceNotation('21d6')).toThrow(DiceNotationError);
  });

  it('throws when nothing found', () => {
    expect(() => parseDiceNotation('foo')).toThrow(DiceNotationError);
  });

  it('trims whitespace', () => {
    expect(parseDiceNotation('  2d6  ').raw).toBe('2d6');
  });
});

describe('expandNotation', () => {
  it('expands 2d6 into two dice', () => {
    const expanded = expandNotation(parseDiceNotation('2d6'));
    expect(expanded).toHaveLength(2);
    expect(expanded.every(d => d.registryId === 'd6')).toBe(true);
  });

  it('expands 1d100 into two d10 dice', () => {
    const expanded = expandNotation(parseDiceNotation('1d100'));
    expect(expanded).toHaveLength(2);
    const tens = expanded.find(d => d.isTens);
    const ones = expanded.find(d => !d.isTens);
    expect(tens?.registryId).toBe('d10-tens');
    expect(ones?.registryId).toBe('d10');
    expect(tens?.pairId).toBe(ones?.pairId);
    expect(tens?.publicType).toBe('d100');
  });

  it('gives each die a unique id', () => {
    const expanded = expandNotation(parseDiceNotation('4d6'));
    const ids = new Set(expanded.map(d => d.id));
    expect(ids.size).toBe(4);
  });

  it('creates two pairs for 2d100', () => {
    const expanded = expandNotation(parseDiceNotation('2d100'));
    const pairIds = new Set(expanded.map(d => d.pairId));
    expect(pairIds.size).toBe(2);
  });
});
