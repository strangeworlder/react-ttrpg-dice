import * as THREE from 'three';
export function createD8Geometry(radius = 0.65): THREE.BufferGeometry {
  return new THREE.OctahedronGeometry(radius, 0);
}
