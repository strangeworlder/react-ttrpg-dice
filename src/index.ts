"use client";

// ─── Main public API ──────────────────────────────────────────────────────────
export { DiceOverlay }    from './components/dice-overlay.js';
export { useDiceRoll }    from './use-dice-roll.js'; // source: use-dice-roll.tsx
export type { RollOptions } from './use-dice-roll.js';

// ─── Registry & parser (advanced use) ────────────────────────────────────────
export { DieRegistry }          from './registry.js';
export { parseDiceNotation, expandNotation, expandGroups, DiceNotationError } from './parser.js';

// ─── Types ───────────────────────────────────────────────────────────────────
export type {
  ReactTTRPGDiceProps,
  RollResult,
  SingleDieResult,
  DiceThemeConfig,
  DiceGroup,
  CustomTextureMap,
  DieDefinition,
  DiePhysicsConfig,
  ReadStrategy,
  DieType,
  ParsedNotation,
  ParsedDieGroup,
  ExpandedDie,
  CameraAngle,
  SoundConfig,
} from './types.js';
