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

  // Grouped geometry: per-face UV + material groups (cached by die type)
  const geometry = useMemo(() => getGroupedGeometry(definition.id), [definition.id]);
  // Face material array: one MeshStandardMaterial with canvas texture per face
  const materials = useMemo(() => getDieFaceMaterials(definition, theme), [definition, theme]);

  useEffect(() => {
    const t = setTimeout(() => {
      const rb = rbRef.current;
      if (!rb) return;

      onRegister(id, rb);

      const { linear, angular } = calculateThrowImpulse(definition.physics.mass);
      rb.applyImpulse({ x: linear[0], y: linear[1], z: linear[2] }, true);
      rb.applyTorqueImpulse({ x: angular[0], y: angular[1], z: angular[2] }, true);
    }, 100);

    return () => {
      clearTimeout(t);
      onUnregister(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fake-perspective: scale the visual mesh based on height (closer to cam → bigger).
  // Only the visual mesh scales — the physics collider stays at its original size.
  useFrame(() => {
    const rb = rbRef.current;
    const mesh = meshRef.current;
    if (!rb || !mesh) return;

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
        ccdEnabled
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
