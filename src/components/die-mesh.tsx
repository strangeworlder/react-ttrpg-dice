"use client";

import { useRef, useEffect, useMemo, useState, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody } from '@react-three/rapier';
import type { RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import type { Mesh, Material } from 'three';
import type { DieDefinition } from '../types.js';
import type { ThemeDefinition } from '../themes/theme-definitions.js';
import { getGroupedGeometry, extractFaceNormals } from '../geometry/face-groups.js';
import { getDieFaceMaterials, getScrambledFaceMaterials, getRevealFaceMaterials } from '../geometry/face-textures.js';
import { D4_VERTEX_POSITIONS } from '../geometry/procedural-d4.js';
import { calculateThrowImpulse } from '../physics/throw-impulse.js';
import { DieShadow } from './die-shadow.js';
import type { DiceSoundEngine } from '../sound/dice-sound.js';

// ─── Fake perspective for the orthographic camera ─────────────────────────────
const CAM_Y = 20;
const SCALE_FACTOR = 0.03;

/** Duration of the emissive reveal flash (ms) */
const REVEAL_FLASH_MS = 300;

const WORLD_UP = new THREE.Vector3(0, 1, 0);
const _v3 = new THREE.Vector3();

/**
 * Finds which face index has its normal pointing most toward +Y.
 * Used to determine which face is visible from above on a settled die.
 */
function findUpFaceIndex(
  quaternion: THREE.Quaternion,
  normals: [number, number, number][],
): number {
  let bestIdx = 0;
  let bestDot = -Infinity;
  for (let i = 0; i < normals.length; i++) {
    const dot = _v3.set(normals[i][0], normals[i][1], normals[i][2])
      .applyQuaternion(quaternion).dot(WORLD_UP);
    if (dot > bestDot) { bestDot = dot; bestIdx = i; }
  }
  return bestIdx;
}

/**
 * Finds which vertex of the D4 tetrahedron has the highest world-Y.
 * This is the apex vertex visible from above.
 */
function findApexVertex(
  quaternion: THREE.Quaternion,
  vertexPositions: [number, number, number][],
): number {
  let bestIdx = 0;
  let bestY = -Infinity;
  for (let i = 0; i < vertexPositions.length; i++) {
    const y = _v3.set(vertexPositions[i][0], vertexPositions[i][1], vertexPositions[i][2])
      .applyQuaternion(quaternion).y;
    if (y > bestY) { bestY = y; bestIdx = i; }
  }
  return bestIdx;
}

interface DieMeshProps {
  id: string;
  definition: DieDefinition;
  spawnPosition: [number, number, number];
  spawnRotation: [number, number, number];
  theme: ThemeDefinition;
  onSleep: (id: string, rb: RapierRigidBody) => void;
  onRegister: (id: string, rb: RapierRigidBody) => void;
  onUnregister: (id: string) => void;
  soundEngine?: DiceSoundEngine | null;
  /** When true, die starts with scrambled glyphs and reveals real values on settle */
  predetermined?: boolean;
  /** Signal from parent that this die should reveal its real face values */
  revealSignal?: boolean;
  /** The specific value this die should display when revealed (face value, not user-facing) */
  predeterminedValue?: number;
}

export function DieMesh({
  id, definition, spawnPosition, spawnRotation,
  theme, onSleep, onRegister, onUnregister, soundEngine,
  predetermined, revealSignal, predeterminedValue,
}: DieMeshProps) {
  const rbRef = useRef<RapierRigidBody>(null);
  const meshRef = useRef<Mesh>(null);
  /**
   * Frame counter: tracks how many frames the rigid body has been available.
   * We need to wait for the Physics component's useFrame to run its first
   * step (which initialises body state from declarative props) before we
   * apply the throw impulse — otherwise the impulse is overwritten by that
   * initialisation and the dice fall straight down without spinning.
   *
   * Timeline:
   *   Frame 0 – rbRef becomes available; Physics hasn't stepped yet.
   *   Frame 1 – Physics runs its first step, body is fully registered.
   *   Frame 2 – We apply the throw impulse.  Safe from overwrites.
   */
  const readyFrames = useRef(0);

  // ─── Material state for predetermined rolls ─────────────────────────────
  const [revealed, setRevealed] = useState(false);
  const flashStartTime = useRef<number | null>(null);

  // Geometry-derived face normals for orientation detection
  const geoNormals = useMemo(() => extractFaceNormals(definition.id), [definition.id]);

  // Grouped geometry: per-face UV + material groups (cached by die type)
  const geometry = useMemo(() => getGroupedGeometry(definition.id), [definition.id]);

  // Real face materials (used for normal rolls)
  const realMaterials = useMemo(() => getDieFaceMaterials(definition, theme), [definition, theme]);

  // Reveal materials — computed at reveal time based on die orientation.
  // Stored in state so React re-renders with the new materials.
  const [revealMats, setRevealMats] = useState<
    THREE.MeshPhysicalMaterial[] | THREE.MeshStandardMaterial[] | null
  >(null);

  // Scrambled materials (only created for predetermined rolls)
  const scrambledMaterials = useMemo(
    () => predetermined ? getScrambledFaceMaterials(definition, theme) : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [predetermined, definition.id],
  );

  // Pick active materials based on roll state
  let activeMaterials: typeof realMaterials;
  if (predetermined && !revealed) {
    activeMaterials = scrambledMaterials ?? realMaterials;
  } else if (predetermined && revealed) {
    activeMaterials = revealMats ?? realMaterials;
  } else {
    activeMaterials = realMaterials;
  }

  // Pre-compute the impulse once so it's deterministic per mount
  const impulse = useMemo(() => calculateThrowImpulse(definition.physics.mass), [definition.physics.mass]);

  // ─── Reveal trigger ─────────────────────────────────────────────────────
  const doReveal = useCallback(() => {
    if (revealed || !predetermined || predeterminedValue === undefined) return;
    const rb = rbRef.current;
    if (!rb) return;

    // Read the die's current orientation to determine which face/vertex is up
    const rot = rb.rotation();
    const quaternion = new THREE.Quaternion(rot.x, rot.y, rot.z, rot.w);

    let upFaceIdx = 0;
    let apexVtx: number | undefined;

    if (definition.id === 'd4') {
      // D4: find the apex vertex (highest Y) for corner-based rendering
      apexVtx = findApexVertex(quaternion, D4_VERTEX_POSITIONS);
      // upFaceIndex not used for D4 but pass 0 as dummy
    } else {
      // Standard dice: find the face pointing most toward +Y
      upFaceIdx = findUpFaceIndex(quaternion, geoNormals);
    }

    const mats = getRevealFaceMaterials(definition, theme, predeterminedValue, upFaceIdx, apexVtx);
    setRevealMats(mats);
    setRevealed(true);
    flashStartTime.current = performance.now();
  }, [revealed, predetermined, predeterminedValue, definition, theme, geoNormals]);

  // React to parent's reveal signal
  useEffect(() => {
    if (revealSignal && !revealed && predetermined) {
      doReveal();
    }
  }, [revealSignal, revealed, predetermined, doReveal]);

  useEffect(() => {
    return () => {
      onUnregister(id);

      // Dispose uncached materials (scrambled + reveal) to prevent GPU leaks.
      // realMaterials are cached in _matCache and should NOT be disposed here.
      const disposeMats = (mats: (THREE.MeshPhysicalMaterial | THREE.MeshStandardMaterial)[] | null) => {
        if (!mats) return;
        for (const m of mats) {
          m.map?.dispose();
          (m as THREE.MeshStandardMaterial).emissiveMap?.dispose();
          m.dispose();
        }
      };
      disposeMats(scrambledMaterials);
      disposeMats(revealMats);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fake-perspective + throw-impulse application + reveal flash.
  useFrame(() => {
    const rb = rbRef.current;
    const mesh = meshRef.current;
    if (!rb || !mesh) return;

    // ── Apply throw impulse after the physics world has initialised ────────
    if (readyFrames.current < 3) {
      readyFrames.current++;

      if (readyFrames.current === 2) {
        onRegister(id, rb);
      }

      if (readyFrames.current === 3) {
        rb.applyImpulse(
          { x: impulse.linear[0], y: impulse.linear[1], z: impulse.linear[2] },
          true,
        );
        rb.applyTorqueImpulse(
          { x: impulse.angular[0], y: impulse.angular[1], z: impulse.angular[2] },
          true,
        );
      }
    }

    const height = Math.max(0, rb.translation().y);
    const s = 1 + height * SCALE_FACTOR;
    mesh.scale.set(s, s, s);

    // ── Reveal flash animation ─────────────────────────────────────────────
    if (flashStartTime.current !== null) {
      const elapsed = performance.now() - flashStartTime.current;
      const t = Math.min(elapsed / REVEAL_FLASH_MS, 1.0);

      const flashIntensity = (1 - t) * 3.0;
      const baseMats = mesh.material as Material[];
      if (Array.isArray(baseMats)) {
        for (const mat of baseMats) {
          if ('emissiveIntensity' in mat) {
            (mat as { emissiveIntensity: number }).emissiveIntensity = 0.9 + flashIntensity;
          }
        }
      }

      if (t >= 1.0) {
        flashStartTime.current = null;
        if (Array.isArray(baseMats)) {
          for (const mat of baseMats) {
            if ('emissiveIntensity' in mat) {
              (mat as { emissiveIntensity: number }).emissiveIntensity = 0.9;
            }
          }
        }
      }
    }
  });

  return (
    <>
      {/* Blob shadow — lives outside the RigidBody so physics doesn't move it;
          it reads the body's translation each frame to self-position. */}
      <DieShadow rbRef={rbRef} />

      <RigidBody
        ref={rbRef}
        position={spawnPosition}
        rotation={spawnRotation}
        colliders="hull"
        ccd
        mass={definition.physics.mass}
        friction={definition.physics.friction}
        restitution={definition.physics.restitution}
        linearDamping={definition.physics.linearDamping}
        angularDamping={definition.physics.angularDamping}
        onCollisionEnter={() => {
          if (!soundEngine || !rbRef.current) return;
          const lv = rbRef.current.linvel();
          const speed = Math.sqrt(lv.x ** 2 + lv.y ** 2 + lv.z ** 2);
          const height = Math.max(0, rbRef.current.translation().y);
          soundEngine.playHit(speed, height);
        }}
        onSleep={() => {
          rbRef.current && onSleep(id, rbRef.current);
        }}
      >
        <mesh ref={meshRef} geometry={geometry} material={activeMaterials} />
      </RigidBody>
    </>
  );
}
