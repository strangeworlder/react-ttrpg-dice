import { describe, it, expect } from 'vitest';
import { readD100 } from './read-d100.js';

describe('readD100', () => {
  it('00 + 0 = 100 (convention: double zero = 100)', () => {
    expect(readD100(0, 0)).toBe(100);
  });

  it('00 + 1 = 1', () => {
    expect(readD100(0, 1)).toBe(1);
  });

  it('00 + 9 = 9', () => {
    expect(readD100(0, 9)).toBe(9);
  });

  it('10 + 0 = 10', () => {
    expect(readD100(10, 0)).toBe(10);
  });

  it('50 + 5 = 55', () => {
    expect(readD100(50, 5)).toBe(55);
  });

  it('90 + 9 = 99', () => {
    expect(readD100(90, 9)).toBe(99);
  });

  it('90 + 0 = 90', () => {
    expect(readD100(90, 0)).toBe(90);
  });

  it('70 + 3 = 73', () => {
    expect(readD100(70, 3)).toBe(73);
  });
});
