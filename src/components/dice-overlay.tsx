"use client";

import { Suspense, useEffect, useRef, useState, useMemo, Component } from 'react';
import type { ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import type { ReactTTRPGDiceProps, RollResult } from '../types.js';
import { DieRegistry } from '../registry.js';
import { parseDiceNotation, expandNotation, expandGroups } from '../parser.js';
import { instantRoll, instantGroupedRoll } from '../math/instant-roll.js';
import { applyTheme } from '../themes/apply-theme.js';
import { PhysicsScene } from './physics-scene.js';

// ─── Timing constants ─────────────────────────────────────────────────────────
const LINGER_MS = 2200;   // dice stay fully visible after result
const FADE_MS   = 600;    // CSS fade-out duration

// ─── Styles ───────────────────────────────────────────────────────────────────
const SR_ONLY: React.CSSProperties = {
  position: 'absolute', width: 1, height: 1, overflow: 'hidden',
  clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0,
};

function overlayStyle(opacity: number, transition: string): React.CSSProperties {
  return {
    position: 'fixed', inset: 0, zIndex: 9999,
    pointerEvents: 'none', background: 'transparent',
    opacity, transition,
  };
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// ─── Error boundary ───────────────────────────────────────────────────────────
interface EBProps { children: ReactNode; onError: () => void; }
interface EBState { hasError: boolean; }

class CanvasErrorBoundary extends Component<EBProps, EBState> {
  state: EBState = { hasError: false };
  static getDerivedStateFromError(): EBState { return { hasError: true }; }
  componentDidCatch() { this.props.onError(); }
  render() { return this.state.hasError ? null : this.props.children; }
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function DiceOverlay({
  roll, config, groups: groupsProp, customRegistry, onRollComplete, onRollStart,
  timeout = 6000,
}: ReactTTRPGDiceProps) {
  const [announcement, setAnnouncement] = useState('');
  const [opacity, setOpacity]           = useState(0);   // starts invisible, fades in
  const [transition, setTransition]     = useState('opacity 0.3s ease-in');
  const firedRef    = useRef(false);
  const lingerTimer = useRef<ReturnType<typeof setTimeout>>();
  const fadeTimer   = useRef<ReturnType<typeof setTimeout>>();

  const registry = useMemo(() => new DieRegistry(customRegistry), [customRegistry]);
  const fallbackTheme = useMemo(() => applyTheme(config), [config]);
  // Ref so grouped memo can read the current fallback without it being a dependency
  const fallbackThemeRef = useRef(fallbackTheme);
  fallbackThemeRef.current = fallbackTheme;

  // ── Simple path: only recomputes when the notation string itself changes ────
  const simpleData = useMemo(() => {
    const p = parseDiceNotation(roll);
    return { dice: expandNotation(p), notation: roll, parsed: p };
  }, [roll]);

  // ── Advanced path: only recomputes when the groups array itself changes ─────
  // fallbackTheme is read from a ref so a theme-reference change alone doesn't
  // regenerate die IDs (which would remount the physics scene mid-linger).
  const groupedData = useMemo(() => {
    if (!groupsProp?.length) return null;
    const { dice, combinedNotation } = expandGroups(groupsProp, fallbackThemeRef.current);
    return { dice, notation: combinedNotation };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupsProp]);

  const expanded         = groupedData?.dice     ?? simpleData.dice;
  const combinedNotation = groupedData?.notation  ?? simpleData.notation;
  const parsed           = groupedData ? null     : simpleData.parsed;

  // Fade-in when overlay mounts
  useEffect(() => {
    const id = requestAnimationFrame(() => setOpacity(1));
    return () => cancelAnimationFrame(id);
  }, []);

  /** Begin linger → fade → notify parent sequence */
  const startDismiss = (result: RollResult) => {
    // Notify parent immediately so result panel shows right away
    onRollComplete(result);

    if (prefersReducedMotion()) return; // no animation delay

    lingerTimer.current = setTimeout(() => {
      setTransition(`opacity ${FADE_MS}ms ease-out`);
      setOpacity(0);
      // Parent (useDiceRoll) unmounts us after LINGER_MS + FADE_MS + 200ms buffer
    }, LINGER_MS);
  };

  /** Instant roll fallback — no 3D physics */
  const fireInstant = () => {
    if (firedRef.current) return;
    firedRef.current = true;
    let result: RollResult;
    if (groupsProp?.length) {
      // Advanced: instantGroupedRoll handles per-group labels
      result = instantGroupedRoll(groupsProp, registry);
    } else {
      result = instantRoll(parsed!, registry);
    }
    const vals = result.rolls.map(r => r.value).join(', ');
    setAnnouncement(`Rolled ${vals}. Total: ${result.total}.`);
    startDismiss(result);
  };

  useEffect(() => {
    firedRef.current = false;
    // Build aria label from either groups or parsed notation
    let label: string;
    if (groupsProp?.length) {
      label = groupsProp.map(g => {
        const p = parseDiceNotation(g.notation);
        const desc = p.groups.map(pg => `${pg.count} ${pg.type}`).join(' and ');
        return g.label ? `${g.label}: ${desc}` : desc;
      }).join(', ');
    } else {
      label = parsed!.groups.map(g => `${g.count} ${g.type}`).join(' and ');
    }
    setAnnouncement(`Rolling ${label}…`);
    onRollStart?.();

    if (prefersReducedMotion()) { fireInstant(); return; }

    // Absolute last resort if Canvas or PhysicsScene never mounts
    // (N.B.: do NOT use a document-level webglcontextlost here — it fires for
    //  any canvas, including HMR tooling, causing false positives in real browsers.
    //  The per-canvas listener in onCreated handles true context loss.)
    const lastResort = setTimeout(fireInstant, timeout + 2000);

    return () => {
      clearTimeout(lastResort);
      clearTimeout(lingerTimer.current);
      clearTimeout(fadeTimer.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roll]);

  /** Called by PhysicsScene when all dice have settled */
  const handleComplete = (result: RollResult) => {
    if (firedRef.current) return;
    firedRef.current = true;
    const vals = result.rolls.map(r => r.value).join(', ');
    setAnnouncement(`Rolled ${vals}. Total: ${result.total}.`);
    startDismiss(result);
  };

  const srRegion = (
    <div role="status" aria-live="polite" aria-atomic="true" style={SR_ONLY}>
      {announcement}
    </div>
  );

  if (prefersReducedMotion()) return srRegion;

  return (
    <>
      {srRegion}

      <CanvasErrorBoundary onError={fireInstant}>
        <Canvas
          style={overlayStyle(opacity, transition)}
          orthographic
          camera={{ position: [0, 20, 0], zoom: 60, near: 0.1, far: 100, up: [0, 0, -1] }}
          gl={{
            alpha: true,
            antialias: true,
            logarithmicDepthBuffer: true,   // needed for transmission z-accuracy
          }}
          onCreated={({ gl }) => {
            gl.toneMapping = THREE.ACESFilmicToneMapping;
            gl.toneMappingExposure = 1.0;
            gl.outputColorSpace = THREE.SRGBColorSpace;
            gl.domElement.addEventListener('webglcontextlost', fireInstant, { once: true });
          }}
        >
          <Suspense fallback={null}>
            <PhysicsScene
              expandedDice={expanded}
              notation={combinedNotation}
              registry={registry}
              theme={fallbackTheme}
              timeout={timeout}
              onRollComplete={handleComplete}
            />
          </Suspense>
        </Canvas>
      </CanvasErrorBoundary>
    </>
  );
}
