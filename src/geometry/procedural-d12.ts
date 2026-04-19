import * as THREE from 'three';
export function createD12Geometry(radius = 0.65): THREE.BufferGeometry {
  return new THREE.DodecahedronGeometry(radius, 0);
}
