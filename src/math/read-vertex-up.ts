import * as THREE from 'three';

export interface VertexReadResult {
  value: number;
  vertexIndex: number;
}

const _v = new THREE.Vector3();

/**
 * D4 reads by finding the vertex with the highest world-space Y position.
 * A D4 rests on a face, leaving a single vertex pointing up.
 */
export function readVertexUp(
  quaternion: THREE.Quaternion,
  worldPosition: THREE.Vector3,
  vertexPositions: ReadonlyArray<[number, number, number]>,
  faceValues: ReadonlyArray<number>,
): VertexReadResult {
  let highestY = -Infinity;
  let bestIndex = 0;

  for (let i = 0; i < vertexPositions.length; i++) {
    const worldY = _v.set(...vertexPositions[i]).applyQuaternion(quaternion).y + worldPosition.y;
    if (worldY > highestY) { highestY = worldY; bestIndex = i; }
  }

  return { value: faceValues[bestIndex] ?? bestIndex + 1, vertexIndex: bestIndex };
}
