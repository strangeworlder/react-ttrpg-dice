import * as THREE from 'three';

export interface FaceReadResult {
  value: number;
  /** 1.0 = perfectly flat, <COCKED_THRESHOLD = possibly cocked */
  confidence: number;
  faceIndex: number;
}

const WORLD_UP = new THREE.Vector3(0, 1, 0);
const _local = new THREE.Vector3();

/**
 * Returns the face whose local normal points most toward world +Y (sky).
 * Call this after a die's rigid body has fired its onSleep event.
 */
export function readFaceUp(
  quaternion: THREE.Quaternion,
  faceNormals: ReadonlyArray<[number, number, number]>,
  faceValues: ReadonlyArray<number>,
): FaceReadResult {
  let bestDot = -Infinity;
  let bestIndex = 0;

  for (let i = 0; i < faceNormals.length; i++) {
    const dot = _local.set(...faceNormals[i]).applyQuaternion(quaternion).dot(WORLD_UP);
    if (dot > bestDot) { bestDot = dot; bestIndex = i; }
  }

  return {
    value: faceValues[bestIndex] ?? bestIndex + 1,
    confidence: bestDot,
    faceIndex: bestIndex,
  };
}

/**
 * Returns the face whose local normal points most toward world −Y (floor).
 * Used for the real-world D4 convention: the face touching the table is the result.
 */
export function readFaceDown(
  quaternion: THREE.Quaternion,
  faceNormals: ReadonlyArray<[number, number, number]>,
  faceValues: ReadonlyArray<number>,
): FaceReadResult {
  let worstDot = Infinity;  // we want the MINIMUM (most toward −Y)
  let bestIndex = 0;

  for (let i = 0; i < faceNormals.length; i++) {
    const dot = _local.set(...faceNormals[i]).applyQuaternion(quaternion).dot(WORLD_UP);
    if (dot < worstDot) { worstDot = dot; bestIndex = i; }
  }

  return {
    value: faceValues[bestIndex] ?? bestIndex + 1,
    confidence: -worstDot,  // negate: most downward = most confident
    faceIndex: bestIndex,
  };
}
