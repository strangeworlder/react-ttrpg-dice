"use client";

import { useRef, useEffect, useMemo, useCallback } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { Physics, CuboidCollider } from '@react-three/rapier';
import type { RapierRigidBody } from '@react-three/rapier';
import type { OrthographicCamera } from 'three';
import type { ExpandedDie, RegistryId, RollResult } from '../types.js';
import type { ThemeDefinition } from '../themes/theme-definitions.js';
import { DieRegistry } from '../registry.js';
import { DieMesh } from './die-mesh.js';
import { calculateSpawnPositions } from '../physics/spawn-grid.js';
import { readDieResult, COCKED_THRESHOLD } from '../physics/read-die.js';
import { extractFaceNormals } from '../geometry/face-groups.js';
import { buildRollResult } from '../math/build-roll-result.js';

// ─── Physics tuning ────────────────────────────────────────────────────────────

const NUDGE = { x: 0, y: 0.5, z: 0.15 };

/**
 * Maximum linear speed (m/s) any die is allowed to travel.
 * Velocity is clamped every frame — prevents high-speed dice from tunnelling
 * through walls or flying out of the visible area.
 */
const MAX_LIN_SPEED   = 7.0;
const MAX_LIN_SPEED_2 = MAX_LIN_SPEED ** 2;
const MAX_ANG_SPEED   = 18.0;   // rad/s — caps spin rate
const MAX_ANG_SPEED_2 = MAX_ANG_SPEED ** 2;

/**
 * Progressive damping: after DAMP_GRACE_S seconds, linear and angular
 * damping ramp linearly from BASE_DAMP up to BASE_DAMP + EXTRA_DAMP over
 * DAMP_RAMP_S seconds, ensuring dice always stop rather than creep forever.
 */
const DAMP_GRACE_S = 1.8;   // free-rolling window
const DAMP_RAMP_S  = 3.5;   // seconds to ramp from base to max
const BASE_DAMP    = 0.3;
const EXTRA_DAMP   = 5.0;   // peak added damping — linear up to 5.3, angular up to 8.0

/** Squared-speed threshold at which a die is considered motionless */
const STILL_VEL2     = 0.008;
/** Frames before velocity polling starts (≈ 2 s at 60 fps) */
const GRACE_FRAMES   = 120;
/** Frames between each velocity sample */
const SAMPLE_EVERY   = 30;
/**
 * Consecutive still samples required before firing.
 * 3 × 30 frames ≈ 1.5 s of confirmed stillness — ensures results are never
 * read from a die that is still in motion.
 */
const STILL_REQUIRED = 3;
const MAX_NUDGE_TRIES = 3;

interface PhysicsSceneProps {
  expandedDice: ExpandedDie[];
  notation: string;
  registry: DieRegistry;
  theme: ThemeDefinition;
  timeout: number;
  onRollComplete: (result: RollResult) => void;
}

export function PhysicsScene({ expandedDice, notation, registry, theme, timeout, onRollComplete }: PhysicsSceneProps) {
  const { size, camera } = useThree();
  const cam = camera as OrthographicCamera;

  const halfX = size.width  / (2 * (cam.zoom || 60));
  const halfZ = size.height / (2 * (cam.zoom || 60));

  // ─── Refs ──────────────────────────────────────────────────────────────────
  const resolvedValues = useRef<Map<string, number>>(new Map());
  const settledIds     = useRef<Set<string>>(new Set());
  const nudgeTries     = useRef<Map<string, number>>(new Map());
  const completed      = useRef(false);
  const rbMap          = useRef<Map<string, RapierRigidBody>>(new Map());
  const frameCount     = useRef(0);
  const elapsedTime    = useRef(0);
  const stillCount     = useRef(0);

  // ─── Geometry-derived normals ──────────────────────────────────────────────
  const geoNormals = useMemo<Map<RegistryId, [number, number, number][]>>(() => {
    const m = new Map<RegistryId, [number, number, number][]>();
    for (const die of expandedDice) {
      if (!m.has(die.registryId)) {
        m.set(die.registryId, extractFaceNormals(die.registryId));
      }
    }
    return m;
  }, [expandedDice]);

  const spawnPositions = useMemo(
    () => calculateSpawnPositions(expandedDice.length, halfX),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [expandedDice.length],
  );

  const fireComplete = useCallback(() => {
    if (completed.current) return;
    completed.current = true;
    const result = buildRollResult(notation, expandedDice, resolvedValues.current, registry);
    onRollComplete(result);
  }, [notation, expandedDice, registry, onRollComplete]);

  // Hard timeout — absolute last resort
  useEffect(() => {
    const t = setTimeout(fireComplete, timeout);
    return () => clearTimeout(t);
  }, [fireComplete, timeout]);

  const registerRb = useCallback((id: string, rb: RapierRigidBody) => {
    rbMap.current.set(id, rb);
  }, []);

  const unregisterRb = useCallback((id: string) => {
    rbMap.current.delete(id);
  }, []);

  /**
   * Reads and records a die's face value.
   * Returns true if the die was successfully committed to resolvedValues.
   */
  const resolveDie = (id: string, rb: RapierRigidBody): boolean => {
    if (settledIds.current.has(id)) return true;
    const die = expandedDice.find(d => d.id === id);
    if (!die) return false;

    const def = registry.get(die.registryId);
    const gn  = geoNormals.get(die.registryId);
    const { value, confidence } = readDieResult(rb, def, gn);

    if (confidence < COCKED_THRESHOLD) {
      const tries = (nudgeTries.current.get(id) ?? 0) + 1;
      nudgeTries.current.set(id, tries);
      if (tries < MAX_NUDGE_TRIES) {
        // Still have budget — nudge and wait for next onSleep
        rb.applyImpulse(NUDGE, true);
      } else {
        // Budget exhausted: commit best available reading immediately
        resolvedValues.current.set(id, value);
        settledIds.current.add(id);
        return true;
      }
      return false;
    }

    resolvedValues.current.set(id, value);
    settledIds.current.add(id);
    return true;
  };

  /** Primary settle path: Rapier onSleep callback per die */
  const handleSleep = useCallback((dieId: string, rb: RapierRigidBody) => {
    if (completed.current) return;
    if (resolveDie(dieId, rb) && settledIds.current.size >= expandedDice.length) {
      fireComplete();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandedDice, geoNormals, registry, fireComplete]);

  useFrame((_, delta) => {
    if (completed.current) return;

    frameCount.current++;
    elapsedTime.current += delta;

    // ── 1. Speed cap + progressive damping (every frame, all bodies) ─────────
    for (const [, rb] of rbMap.current) {
      // --- Linear speed cap ---
      const lv = rb.linvel();
      const lv2 = lv.x ** 2 + lv.y ** 2 + lv.z ** 2;
      if (lv2 > MAX_LIN_SPEED_2) {
        const s = MAX_LIN_SPEED / Math.sqrt(lv2);
        rb.setLinvel({ x: lv.x * s, y: lv.y * s, z: lv.z * s }, false);
      }

      // --- Angular speed cap ---
      const av = rb.angvel();
      const av2 = av.x ** 2 + av.y ** 2 + av.z ** 2;
      if (av2 > MAX_ANG_SPEED_2) {
        const s = MAX_ANG_SPEED / Math.sqrt(av2);
        rb.setAngvel({ x: av.x * s, y: av.y * s, z: av.z * s }, false);
      }

      // --- Progressive damping ---
      // After DAMP_GRACE_S the physical simulation has let dice tumble freely.
      // Ramping damping up from there forces them to stop definitively,
      // preventing endless slow creep that would block result detection.
      if (elapsedTime.current > DAMP_GRACE_S) {
        const t = Math.min(
          (elapsedTime.current - DAMP_GRACE_S) / DAMP_RAMP_S,
          1.0,
        );
        const linDamp = BASE_DAMP + t * EXTRA_DAMP;
        const angDamp = BASE_DAMP + t * EXTRA_DAMP * 1.5; // spin stops faster than slide
        rb.setLinearDamping(linDamp);
        rb.setAngularDamping(angDamp);
      }
    }

    // ── 2. Velocity polling fallback ─────────────────────────────────────────
    // Only runs after grace period.  Requires STILL_REQUIRED consecutive
    // samples of near-zero velocity before accepting result — prevents early
    // reads caused by bounce-apex moments.
    if (frameCount.current < GRACE_FRAMES) return;
    if (frameCount.current % SAMPLE_EVERY !== 0) return;
    if (rbMap.current.size === 0) return;

    let allStill = true;
    for (const [id, rb] of rbMap.current) {
      if (settledIds.current.has(id)) continue;
      const lv = rb.linvel();
      const av = rb.angvel();
      if (lv.x ** 2 + lv.y ** 2 + lv.z ** 2 + av.x ** 2 + av.y ** 2 + av.z ** 2 > STILL_VEL2) {
        allStill = false;
        break;
      }
    }

    if (!allStill) {
      stillCount.current = 0;
      return;
    }

    stillCount.current++;
    if (stillCount.current < STILL_REQUIRED) return;

    // Confirmed still for STILL_REQUIRED consecutive samples → read & fire
    for (const [id, rb] of rbMap.current) {
      resolveDie(id, rb);
    }
    fireComplete();
  });

  const wt = 1.5;
  const wh = 20;

  return (
    <>
      {/* Lighting */}
      <hemisphereLight args={['#c8d8ff', '#4a3a20', 1.2]} />
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 12, 3]} intensity={2.0} />
      <pointLight position={[-6, 8, -5]} intensity={0.8} color="#c0a0ff" />
      <pointLight position={[ 6, 6,  5]} intensity={0.5} color="#ffeecc" />

      <Physics gravity={[0, -9.81, 0]}>
        {/* Floor */}
        <CuboidCollider
          args={[halfX + 2, wt, halfZ + 2]}
          position={[0, -wt, 0]}
          friction={0.6}
          restitution={0.25}
        />
        {/* Walls */}
        <CuboidCollider args={[wt, wh, halfZ + 2]} position={[-halfX - wt, wh * 0.5, 0]} />
        <CuboidCollider args={[wt, wh, halfZ + 2]} position={[ halfX + wt, wh * 0.5, 0]} />
        <CuboidCollider args={[halfX + 2, wh, wt]} position={[0, wh * 0.5,  halfZ + wt]} />
        <CuboidCollider args={[halfX + 2, wh, wt]} position={[0, wh * 0.5, -halfZ - wt]} />

        {expandedDice.map((die, i) => (
          <DieMesh
            key={die.id}
            id={die.id}
            definition={registry.get(die.registryId)}
            spawnPosition={spawnPositions[i]?.position ?? [0, 9, 0]}
            spawnRotation={spawnPositions[i]?.rotation  ?? [0, 0, 0]}
            theme={theme}
            onSleep={handleSleep}
            onRegister={registerRb}
            onUnregister={unregisterRb}
          />
        ))}
      </Physics>
    </>
  );
}
