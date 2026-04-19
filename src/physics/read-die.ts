"use client";

import * as THREE from 'three';
import { quat, vec3 } from '@react-three/rapier';
import type { RapierRigidBody } from '@react-three/rapier';
import type { DieDefinition } from '../types.js';
import { readFaceUp, readFaceDown } from '../math/read-face-up.js';
import { readVertexUp } from '../math/read-vertex-up.js';
import { COCKED_THRESHOLD } from '../math/constants.js';

export interface DieReadResult {
  value: number;
  /** 1.0 = flat; < COCKED_THRESHOLD = needs nudge */
  confidence: number;
}

/**
 * Reads the result of a settled die from its Rapier rigid body.
 * Dispatches to the correct strategy based on the die definition.
 *
 * • face-up   — face whose normal points most toward +Y (sky) = result
 * • face-down — face whose normal points most toward −Y (floor) = result (real D4 convention)
 * • vertex-up — vertex with highest world-Y = result
 *
 * @param geometryNormals — If provided, overrides def.faceNormals with normals derived
 *   directly from the grouped geometry, ensuring the normal used for reading aligns
 *   with the face-group index used for material display.
 */
export function readDieResult(
  rb: RapierRigidBody,
  def: DieDefinition,
  geometryNormals?: [number, number, number][],
): DieReadResult {
  const quaternion = quat(rb.rotation());
  const position   = vec3(rb.translation());

  if (def.readStrategy === 'vertex-up' && def.vertexPositions) {
    const r = readVertexUp(quaternion, position, def.vertexPositions, def.faceValues);
    return { value: r.value, confidence: 1.0 };
  }

  // Prefer geometry-derived normals so reading aligns with face display
  const normals = geometryNormals ?? def.faceNormals;

  if (def.readStrategy === 'face-down') {
    // Real-world D4 convention: bottom face (touching floor) = result
    const r = readFaceDown(quaternion, normals, def.faceValues);
    return { value: r.value, confidence: r.confidence };
  }

  // Default: face-up
  const r = readFaceUp(quaternion, normals, def.faceValues);
  return { value: r.value, confidence: r.confidence };
}

export { COCKED_THRESHOLD };
