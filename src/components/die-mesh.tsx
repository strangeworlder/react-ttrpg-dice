"use client";

import { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody } from '@react-three/rapier';
import type { RapierRigidBody } from '@react-three/rapier';
import type { Mesh } from 'three';
import type { DieDefinition } from '../types.js';
import type { ThemeDefinition } from '../themes/theme-definitions.js';
import { getGroupedGeometry } from '../geometry/face-groups.js';
import { getDieFaceMaterials } from '../geometry/face-textures.js';
import { calculateThrowImpulse } from '../physics/throw-impulse.js';
import { DieShadow } from './die-shadow.js';

// ─── Fake perspective for the orthographic camera ─────────────────────────────
// Camera sits at y = 20.  A die at y = 0 is 20 units away; at y = 10 it's only
// 10 units away — twice as close — and should appear slightly larger.
// We scale the mesh (not the RigidBody) so physics colliders stay unchanged.
const CAM_Y = 20;
const SCALE_FACTOR = 0.03; // extra scale per unit of height (≈ 6 % at y = 10)

interface DieMeshProps {
  id: string;
  definition: DieDefinition;
  spawnPosition: [number, number, number];
  spawnRotation: [number, number, number];
  theme: ThemeDefinition;
  onSleep: (id: string, rb: RapierRigidBody) => void;
  onRegister: (id: string, rb: RapierRigidBody) => void;
  onUnregister: (id: string) => void;
}

export function DieMesh({
  id, definition, spawnPosition, spawnRotation,
  theme, onSleep, onRegister, onUnregister,
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

  // Grouped geometry: per-face UV + material groups (cached by die type)
  const geometry = useMemo(() => getGroupedGeometry(definition.id), [definition.id]);
  // Face material array: one MeshStandardMaterial with canvas texture per face
  const materials = useMemo(() => getDieFaceMaterials(definition, theme), [definition, theme]);

  // Pre-compute the impulse once so it's deterministic per mount
  const impulse = useMemo(() => calculateThrowImpulse(definition.physics.mass), [definition.physics.mass]);

  useEffect(() => {
    return () => { onUnregister(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fake-perspective + throw-impulse application.
  useFrame(() => {
    const rb = rbRef.current;
    const mesh = meshRef.current;
    if (!rb || !mesh) return;

    // ── Apply throw impulse after the physics world has initialised ────────
    if (readyFrames.current < 3) {
      readyFrames.current++;

      if (readyFrames.current === 2) {
        // Register on frame 1 so velocity polling in PhysicsScene can find us
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
        onSleep={() => rbRef.current && onSleep(id, rbRef.current)}
      >
        {/* material prop accepts Material[] — each group uses the matching index */}
        <mesh ref={meshRef} geometry={geometry} material={materials} />
      </RigidBody>
    </>
  );
}
