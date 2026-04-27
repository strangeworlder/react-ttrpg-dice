"use client";

import { useState, useCallback, useRef, createElement } from 'react';
import type { RollResult, DiceThemeConfig, DiceGroup, DieDefinition, CameraAngle, SoundConfig, ReactTTRPGDiceProps } from './types.js';
import { DiceOverlay } from './components/dice-overlay.js';

// Must match LINGER_MS + FADE_MS in dice-overlay.tsx
const UNMOUNT_DELAY = 2200 + 600 + 200; // 3000ms

export interface UseDiceRollOptions {
  onRollComplete?: (result: RollResult) => void;
  config?: DiceThemeConfig;
  customRegistry?: DieDefinition[];
  timeout?: number;
  /** Camera viewing angle — offsets from straight top-down. */
  cameraAngle?: CameraAngle;
  /** Enable dice collision sounds. Default: false */
  sound?: boolean | SoundConfig;
}

export interface RollOptions {
  /**
   * Predetermined results for each die in the notation.
   * Values are final user-facing numbers (e.g. 17 for a d20, 73 for d100).
   * d100 counts as one entry (decomposed internally into tens+ones).
   * When provided, dice display scrambled symbols during flight
   * and reveal these values on settle.
   */
  predeterminedValues?: number[];
}

export interface UseDiceRollReturn {
  roll: (notation: string, opts?: RollOptions) => void;
  /** Advanced: roll multiple groups with per-group themes and labels */
  rollGroups: (groups: DiceGroup[]) => void;
  isRolling: boolean;
  result: RollResult | null;
  activeNotation: string | null;
  DiceOverlayPortal: React.ReactNode;
}

/**
 * Hook that manages roll state and renders DiceOverlay.
 * - `result` is set immediately when physics settles
 * - The 3D overlay lingers 2.2s then fades before unmounting
 *
 * @example Simple roll
 * ```tsx
 * const { roll, isRolling, result, DiceOverlayPortal } = useDiceRoll({ config: { theme: 'crimson' } });
 * <button onClick={() => roll('2d20 + 1d6')}>Roll!</button>
 * {DiceOverlayPortal}
 * ```
 *
 * @example Predetermined roll (multiplayer sync)
 * ```tsx
 * const { roll, DiceOverlayPortal } = useDiceRoll({ onRollComplete: cb });
 * // Server tells us the result is [17, 4, 3]
 * roll('2d20 + 1d6', { predeterminedValues: [17, 4, 3] });
 * ```
 *
 * @example Advanced grouped roll with predetermined values
 * ```tsx
 * const { rollGroups, result, DiceOverlayPortal } = useDiceRoll();
 * rollGroups([
 *   { notation: '1d20', config: { theme: 'crimson' }, label: 'attack', predeterminedValues: [17] },
 *   { notation: '2d6',  config: { theme: 'ivory' },   label: 'damage', predeterminedValues: [4, 6] },
 * ]);
 * ```
 */
export function useDiceRoll(opts?: UseDiceRollOptions): UseDiceRollReturn {
  const [notation, setNotation]   = useState<string | null>(null);
  const [groups, setGroups]       = useState<DiceGroup[] | null>(null);
  const [isRolling, setIsRolling] = useState(false);
  const [result, setResult]       = useState<RollResult | null>(null);
  const [predetermined, setPredetermined] = useState<number[] | undefined>(undefined);
  const optsRef   = useRef(opts);
  const unmountId = useRef<ReturnType<typeof setTimeout>>(undefined);
  optsRef.current = opts;

  /** Simple roll: single notation string, all dice share the same theme */
  const roll = useCallback((n: string, rollOpts?: RollOptions) => {
    clearTimeout(unmountId.current);
    setResult(null);
    setGroups(null);
    setPredetermined(undefined);
    setNotation(null); // unmount old overlay immediately on rapid re-roll
    requestAnimationFrame(() => {
      setNotation(n);
      setPredetermined(rollOpts?.predeterminedValues);
      setIsRolling(true);
    });
  }, []);

  /** Advanced roll: multiple groups with per-group themes and labels */
  const rollGroups = useCallback((g: DiceGroup[]) => {
    clearTimeout(unmountId.current);
    setResult(null);
    setGroups(null);
    setPredetermined(undefined);
    setNotation(null);
    requestAnimationFrame(() => {
      setGroups(g);
      // Use a sentinel notation so the overlay mounts
      setNotation(g.map(gr => gr.notation).join(' + '));
      setIsRolling(true);
    });
  }, []);

  const handleComplete = useCallback((r: RollResult) => {
    setResult(r);
    setIsRolling(false);
    optsRef.current?.onRollComplete?.(r);

    clearTimeout(unmountId.current);
    unmountId.current = setTimeout(() => {
      setNotation(null);
      setGroups(null);
      setPredetermined(undefined);
    }, UNMOUNT_DELAY);
  }, []);

  const DiceOverlayPortal = notation
    ? createElement(DiceOverlay, {
        roll:                notation,
        groups:              groups ?? undefined,
        config:              optsRef.current?.config,
        customRegistry:      optsRef.current?.customRegistry,
        timeout:             optsRef.current?.timeout,
        cameraAngle:         optsRef.current?.cameraAngle,
        onRollComplete:      handleComplete,
        sound:               optsRef.current?.sound,
        predeterminedValues: predetermined,
      } as ReactTTRPGDiceProps)
    : null;

  return { roll, rollGroups, isRolling, result, activeNotation: notation, DiceOverlayPortal };
}
