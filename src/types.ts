import type { ThemeDefinition } from './themes/theme-definitions.js';

// ─── Public die type strings (user-facing) ───────────────────────────────────
export type DieType = 'd4' | 'd6' | 'd8' | 'd10' | 'd12' | 'd20' | 'd100';

/** Internal registry IDs — includes the two d10 variants used for d100 */
export type RegistryId = 'd4' | 'd6' | 'd8' | 'd10' | 'd10-tens' | 'd12' | 'd20';

export interface ParsedDieGroup {
  count: number;
  type: DieType;
}

export interface ParsedNotation {
  groups: ParsedDieGroup[];
  raw: string;
}

/** A single physical die to be spawned in the scene */
export interface ExpandedDie {
  /** Unique instance ID */
  id: string;
  /** Registry key for mesh + physics lookup */
  registryId: RegistryId;
  /** User-facing type (e.g. 'd100' for both d10 sub-dice) */
  publicType: DieType;
  /** Groups tens+ones pair for d100 result calculation */
  pairId?: string;
  /** True = this is the tens die of a d100 pair */
  isTens?: boolean;
  /** Group label from DiceGroup.label (advanced grouped rolls) */
  group?: string;
  /** Per-die theme override resolved from DiceGroup.config */
  theme?: ThemeDefinition;
}

// ─── Roll Result ─────────────────────────────────────────────────────────────
export interface SingleDieResult {
  type: DieType;
  value: number;
  isMax: boolean;
  isMin: boolean;
  /** Group label, if this die was part of a labeled DiceGroup */
  group?: string;
}

export interface RollResult {
  notation: string;
  total: number;
  rolls: SingleDieResult[];
}

// ─── Die Definition (Registry) ───────────────────────────────────────────────
export interface DiePhysicsConfig {
  mass: number;
  friction: number;
  /** Bounciness 0–1 */
  restitution: number;
  linearDamping: number;
  angularDamping: number;
}

export type ReadStrategy = 'face-up' | 'face-down' | 'vertex-up';

export interface DieDefinition {
  id: RegistryId;
  sides: number;
  /** Path to .glb asset — empty string uses procedural fallback */
  modelPath: string;
  physics: DiePhysicsConfig;
  readStrategy: ReadStrategy;
  /**
   * Local-space face normals (one per face) for face-up reading.
   * ⚠️ Approximate — calibrate against actual GLB once sourced.
   */
  faceNormals: [number, number, number][];
  /**
   * Value for each face (indexed by faceNormals) or each vertex (vertex-up).
   * ⚠️ Requires calibration against actual GLB.
   */
  faceValues: number[];
  /**
   * Local-space vertex positions for vertex-up reading (D4 only).
   * ⚠️ Requires calibration against actual GLB.
   */
  vertexPositions?: [number, number, number][];
}

// ─── Component API ───────────────────────────────────────────────────────────
export interface DiceThemeConfig {
  theme?: 'obsidian' | 'ivory' | 'crimson' | 'glass' | 'metal';
  dieColor?: string;
  numberColor?: string;
  accentColor?: string;
  roughness?: number;
  metalness?: number;
}

/** Advanced: a group of dice with its own theme and label */
export interface DiceGroup {
  /** Standard dice notation for this group, e.g. "2d6" */
  notation: string;
  /** Optional theme/color override for this group's dice */
  config?: DiceThemeConfig;
  /** Label to tag results with, e.g. "healing", "attack" */
  label?: string;
}

export interface CustomTextureMap {
  [dieType: string]: { [faceValue: number]: string };
}

export interface ReactTTRPGDiceProps {
  /** Standard dice notation: "2d20 + 1d6", "1d100", etc. */
  roll: string;
  config?: DiceThemeConfig;
  /** Advanced: per-group dice with independent themes. Overrides `roll` + `config`. */
  groups?: DiceGroup[];
  customTextures?: CustomTextureMap;
  /** Override or extend built-in die definitions */
  customRegistry?: DieDefinition[];
  /** Fires when all dice have settled with results */
  onRollComplete: (result: RollResult) => void;
  onRollStart?: () => void;
  /** Hard timeout ms before forcing results. Default: 4000 */
  timeout?: number;
}
