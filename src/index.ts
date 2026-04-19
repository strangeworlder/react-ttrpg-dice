"use client";

// ─── Main public API ──────────────────────────────────────────────────────────
export { DiceOverlay }    from './components/dice-overlay.js';
export { useDiceRoll }    from './use-dice-roll.js'; // source: use-dice-roll.tsx

// ─── Registry & parser (advanced use) ────────────────────────────────────────
export { DieRegistry }          from './registry.js';
export { parseDiceNotation, expandNotation, DiceNotationError } from './parser.js';

// ─── Types ───────────────────────────────────────────────────────────────────
export type {
  ReactTTRPGDiceProps,
  RollResult,
  SingleDieResult,
  DiceThemeConfig,
  CustomTextureMap,
  DieDefinition,
  DiePhysicsConfig,
  ReadStrategy,
  DieType,
  ParsedNotation,
  ParsedDieGroup,
  ExpandedDie,
} from './types.js';
