import * as THREE from 'three';
export function createD20Geometry(radius = 0.7): THREE.BufferGeometry {
  return new THREE.IcosahedronGeometry(radius, 0);
}
