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

// ─── Sound ───────────────────────────────────────────────────────────────────
export interface SoundConfig {
  /** Master volume 0–1. Default: 0.6 */
  volume?: number;
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
  /**
   * Predetermined results for this group's dice.
   * Values are final user-facing numbers (e.g. 17 for a d20, 73 for d100).
   * Array length must match the number of dice in the notation.
   * d100 values are decomposed internally into tens+ones.
   */
  predeterminedValues?: number[];
}

export interface CustomTextureMap {
  [dieType: string]: { [faceValue: number]: string };
}

/**
 * Controls the camera viewing angle.
 * Values are in world-space units of offset from the straight top-down position.
 * Small values (e.g. 2–5) give a subtle tilt; larger values create a more
 * dramatic perspective.  Default is `{ x: 0, z: 0 }` (directly overhead).
 */
export interface CameraAngle {
  /** Horizontal offset (left/right tilt). Default: 0 */
  x?: number;
  /** Depth offset (forward/backward tilt). Default: 0 */
  z?: number;
}

interface ReactTTRPGDiceBase {
  config?: DiceThemeConfig;
  customTextures?: CustomTextureMap;
  /** Override or extend built-in die definitions */
  customRegistry?: DieDefinition[];
  /** Fires when all dice have settled with results */
  onRollComplete: (result: RollResult) => void;
  onRollStart?: () => void;
  /** Hard timeout ms before forcing results. Default: 4000 */
  timeout?: number;
  /**
   * Camera viewing angle — offsets the camera from the default straight
   * top-down position to create a tilted perspective.
   * Default: `{ x: 0, z: 0 }` (directly overhead).
   */
  cameraAngle?: CameraAngle;
  /**
   * Enable dice collision sounds via procedural Web Audio synthesis.
   * Pass `true` for defaults, or a `SoundConfig` object to customise.
   * Default: `false` (no sound).
   */
  sound?: boolean | SoundConfig;
  /**
   * Predetermined results for all dice in the roll (simple path).
   * Values are final user-facing numbers (e.g. 17 for a d20, 73 for d100).
   * Array length must match the number of dice in the notation.
   * d100 counts as one entry (decomposed internally into tens+ones).
   * Dice display scrambled symbols during flight and reveal the real
   * values when they settle.
   */
  predeterminedValues?: number[];
}

/** Simple path: a single notation string; all dice share the same theme. */
interface ReactTTRPGDiceSimpleProps extends ReactTTRPGDiceBase {
  /** Standard dice notation: "2d20 + 1d6", "1d100", etc. */
  roll: string;
  /** Cannot be combined with `roll` — use one or the other. */
  groups?: never;
}

/** Advanced path: per-group dice with independent themes. Overrides `roll` + `config`. */
interface ReactTTRPGDiceGroupsProps extends ReactTTRPGDiceBase {
  /** Cannot be combined with `groups` — use one or the other. */
  roll?: never;
  /** Advanced: per-group dice with independent themes. Overrides `roll` + `config`. */
  groups: DiceGroup[];
}

export type ReactTTRPGDiceProps = ReactTTRPGDiceSimpleProps | ReactTTRPGDiceGroupsProps;
