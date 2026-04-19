"use client";

import { useState, useCallback, useRef, createElement } from 'react';
import type { RollResult, DiceThemeConfig, DiceGroup, DieDefinition } from './types.js';
import { DiceOverlay } from './components/dice-overlay.js';

// Must match LINGER_MS + FADE_MS in dice-overlay.tsx
const UNMOUNT_DELAY = 2200 + 600 + 200; // 3000ms

export interface UseDiceRollOptions {
  onRollComplete?: (result: RollResult) => void;
  config?: DiceThemeConfig;
  customRegistry?: DieDefinition[];
  timeout?: number;
}

export interface UseDiceRollReturn {
  roll: (notation: string) => void;
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
 * @example Advanced grouped roll
 * ```tsx
 * const { rollGroups, result, DiceOverlayPortal } = useDiceRoll();
 * rollGroups([
 *   { notation: '1d20', config: { theme: 'crimson' }, label: 'attack' },
 *   { notation: '2d6',  config: { theme: 'ivory' },   label: 'damage' },
 * ]);
 * ```
 */
export function useDiceRoll(opts?: UseDiceRollOptions): UseDiceRollReturn {
  const [notation, setNotation]   = useState<string | null>(null);
  const [groups, setGroups]       = useState<DiceGroup[] | null>(null);
  const [isRolling, setIsRolling] = useState(false);
  const [result, setResult]       = useState<RollResult | null>(null);
  const optsRef   = useRef(opts);
  const unmountId = useRef<ReturnType<typeof setTimeout>>(undefined);
  optsRef.current = opts;

  /** Simple roll: single notation string, all dice share the same theme */
  const roll = useCallback((n: string) => {
    clearTimeout(unmountId.current);
    setResult(null);
    setGroups(null);
    setNotation(null); // unmount old overlay immediately on rapid re-roll
    requestAnimationFrame(() => {
      setNotation(n);
      setIsRolling(true);
    });
  }, []);

  /** Advanced roll: multiple groups with per-group themes and labels */
  const rollGroups = useCallback((g: DiceGroup[]) => {
    clearTimeout(unmountId.current);
    setResult(null);
    setGroups(null);
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
    }, UNMOUNT_DELAY);
  }, []);

  const DiceOverlayPortal = notation
    ? createElement(DiceOverlay, {
        roll:            notation,
        groups:          groups ?? undefined,
        config:          optsRef.current?.config,
        customRegistry:  optsRef.current?.customRegistry,
        timeout:         optsRef.current?.timeout,
        onRollComplete:  handleComplete,
      })
    : null;

  return { roll, rollGroups, isRolling, result, activeNotation: notation, DiceOverlayPortal };
}
