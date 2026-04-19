"use client";

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { RapierRigidBody } from '@react-three/rapier';

/**
 * Soft blob shadow that tracks its associated die's rigid body.
 *
 * As the die rises above the floor the shadow becomes:
 *  - larger  (penumbra spread)
 *  - lighter (less opacity)
 *  - blurrier (texture uses a radial gradient that's baked at construction)
 *
 * The shadow is a simple transparent plane with a radial-gradient texture,
 * projected straight down from the die's XZ position onto y ≈ 0.
 * This avoids the cost of real-time shadow maps and gives a natural
 * "contact shadow" feel that tightens as the die lands.
 */

// ─── Shared radial-gradient texture (resolution-independent circle) ───────────
const SHADOW_SIZE = 128;
let _shadowTex: THREE.Texture | null = null;

function getShadowTexture(): THREE.Texture {
  if (_shadowTex) return _shadowTex;

  const canvas = document.createElement('canvas');
  canvas.width = SHADOW_SIZE;
  canvas.height = SHADOW_SIZE;
  const ctx = canvas.getContext('2d')!;

  const cx = SHADOW_SIZE / 2;
  const r = SHADOW_SIZE / 2;
  const grad = ctx.createRadialGradient(cx, cx, 0, cx, cx, r);
  grad.addColorStop(0.0, 'rgba(0, 0, 0, 1)');
  grad.addColorStop(0.3, 'rgba(0, 0, 0, 0.7)');
  grad.addColorStop(0.7, 'rgba(0, 0, 0, 0.2)');
  grad.addColorStop(1.0, 'rgba(0, 0, 0, 0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, SHADOW_SIZE, SHADOW_SIZE);

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  _shadowTex = tex;
  return tex;
}

// ─── Tuning ───────────────────────────────────────────────────────────────────

/** Base shadow radius when the die sits on the floor (world units) */
const BASE_RADIUS   = 0.6;
/** Additional spread per unit of height */
const SPREAD_RATE   = 0.18;
/** Opacity when the die rests on the floor */
const MAX_OPACITY   = 0.35;
/** Height at which the shadow becomes fully invisible */
const FADE_HEIGHT   = 10;
/** Floor Y position */
const FLOOR_Y       = 0.02;

// Light direction for shadow offset (normalised XZ from directional light at [5,12,3])
const LIGHT_DIR_X =  5;
const LIGHT_DIR_Z =  3;
const LIGHT_DIR_Y = 12;
const LIGHT_XZ_LEN = Math.sqrt(LIGHT_DIR_X ** 2 + LIGHT_DIR_Z ** 2);
const SHADOW_OFFSET_X = (LIGHT_DIR_X / LIGHT_XZ_LEN);  // unit offset direction
const SHADOW_OFFSET_Z = (LIGHT_DIR_Z / LIGHT_XZ_LEN);
/** How far the shadow shifts per unit of height (simulates directional light angle) */
const OFFSET_RATE = LIGHT_XZ_LEN / LIGHT_DIR_Y;

interface DieShadowProps {
  /** Ref to the RapierRigidBody this shadow tracks */
  rbRef: React.RefObject<RapierRigidBody | null>;
}

export function DieShadow({ rbRef }: DieShadowProps) {
  const meshRef = useRef<THREE.Mesh>(null);

  const material = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      map: getShadowTexture(),
      transparent: true,
      depthWrite: false,
      opacity: 0,
    });
  }, []);

  useFrame(() => {
    const rb = rbRef.current;
    const mesh = meshRef.current;
    if (!rb || !mesh) return;

    const pos = rb.translation();
    const height = Math.max(0, pos.y);

    // Opacity: full at floor, fades to 0 at FADE_HEIGHT
    const t = Math.min(height / FADE_HEIGHT, 1);
    material.opacity = MAX_OPACITY * (1 - t * t); // quadratic falloff

    // Scale: grows with height (penumbra spread)
    const radius = BASE_RADIUS + height * SPREAD_RATE;
    mesh.scale.set(radius * 2, radius * 2, 1);

    // Position: project shadow down to the floor, offset in light direction
    const offsetScale = height * OFFSET_RATE;
    mesh.position.set(
      pos.x + SHADOW_OFFSET_X * offsetScale,
      FLOOR_Y,
      pos.z + SHADOW_OFFSET_Z * offsetScale,
    );
  });

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[1, 1]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}
