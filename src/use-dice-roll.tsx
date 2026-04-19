"use client";

import { useState, useCallback, useRef, createElement } from 'react';
import type { RollResult, DiceThemeConfig, DieDefinition } from './types.js';
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
 * @example
 * ```tsx
 * const { roll, isRolling, result, DiceOverlayPortal } = useDiceRoll({ config: { theme: 'crimson' } });
 * <button onClick={() => roll('2d20 + 1d6')}>Roll!</button>
 * {DiceOverlayPortal}
 * ```
 */
export function useDiceRoll(opts?: UseDiceRollOptions): UseDiceRollReturn {
  const [notation, setNotation]   = useState<string | null>(null);
  const [isRolling, setIsRolling] = useState(false);
  const [result, setResult]       = useState<RollResult | null>(null);
  const optsRef   = useRef(opts);
  const unmountId = useRef<ReturnType<typeof setTimeout>>();
  optsRef.current = opts;

  const roll = useCallback((n: string) => {
    // Cancel any in-progress linger timer from a previous roll
    clearTimeout(unmountId.current);
    setResult(null);
    setNotation(null); // unmount old overlay immediately on rapid re-roll
    // Brief rAF so React flushes the unmount before remounting with new notation
    requestAnimationFrame(() => {
      setNotation(n);
      setIsRolling(true);
    });
  }, []);

  const handleComplete = useCallback((r: RollResult) => {
    setResult(r);
    setIsRolling(false);   // show result panel immediately
    optsRef.current?.onRollComplete?.(r);

    // Keep the DiceOverlay mounted so it can linger + fade, then unmount
    clearTimeout(unmountId.current);
    unmountId.current = setTimeout(() => setNotation(null), UNMOUNT_DELAY);
  }, []);

  const DiceOverlayPortal = notation
    ? createElement(DiceOverlay, {
        roll:            notation,
        config:          optsRef.current?.config,
        customRegistry:  optsRef.current?.customRegistry,
        timeout:         optsRef.current?.timeout,
        onRollComplete:  handleComplete,
      })
    : null;

  return { roll, isRolling, result, activeNotation: notation, DiceOverlayPortal };
}
