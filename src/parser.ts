import type { DieType, ExpandedDie, ParsedDieGroup, ParsedNotation, RegistryId } from './types.js';

const VALID_SIDES: ReadonlySet<number> = new Set([4, 6, 8, 10, 12, 20, 100]);
const DIE_PATTERN = /(\d*)d(\d+)/gi;
const MAX_COUNT = 20;

export class DiceNotationError extends Error {
  constructor(message: string, public readonly notation: string) {
    super(message);
    this.name = 'DiceNotationError';
  }
}

/**
 * Parses standard TTRPG dice notation.
 * Accepts: "1d20", "2d6 + 1d4", "d20", "3D6", "1d100"
 * @throws DiceNotationError for invalid input
 */
export function parseDiceNotation(notation: string): ParsedNotation {
  if (!notation || typeof notation !== 'string') {
    throw new DiceNotationError('Notation must be a non-empty string.', String(notation));
  }
  const trimmed = notation.trim();
  if (!trimmed) throw new DiceNotationError('Notation cannot be empty.', notation);

  const groups: ParsedDieGroup[] = [];
  DIE_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = DIE_PATTERN.exec(trimmed)) !== null) {
    const count = match[1] === '' ? 1 : parseInt(match[1], 10);
    const sides = parseInt(match[2], 10);

    if (isNaN(count) || count < 1 || count > MAX_COUNT) {
      throw new DiceNotationError(
        `Die count must be 1–${MAX_COUNT}, got "${match[1]}".`, notation);
    }
    if (!VALID_SIDES.has(sides)) {
      const valid = [...VALID_SIDES].map(s => `d${s}`).join(', ');
      throw new DiceNotationError(`Invalid die: d${sides}. Valid: ${valid}`, notation);
    }
    groups.push({ count, type: `d${sides}` as DieType });
  }

  if (groups.length === 0) {
    throw new DiceNotationError(`No valid dice found in: "${trimmed}"`, notation);
  }
  return { groups, raw: trimmed };
}

let _counter = 0;
const uid = (prefix: string) => `${prefix}-${++_counter}`;

/**
 * Expands parsed notation into individual physical dice to spawn.
 * d100 → two d10 dice (tens + ones) sharing a pairId.
 */
export function expandNotation(parsed: ParsedNotation): ExpandedDie[] {
  const dice: ExpandedDie[] = [];

  for (const group of parsed.groups) {
    for (let i = 0; i < group.count; i++) {
      if (group.type === 'd100') {
        const pairId = uid('pair');
        dice.push({ id: uid('d10-tens'), registryId: 'd10-tens', publicType: 'd100', pairId, isTens: true });
        dice.push({ id: uid('d10'),      registryId: 'd10',      publicType: 'd100', pairId, isTens: false });
      } else {
        dice.push({ id: uid(group.type), registryId: group.type as RegistryId, publicType: group.type });
      }
    }
  }
  return dice;
}
