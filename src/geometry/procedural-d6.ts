import * as THREE from 'three';
export function createD6Geometry(size = 0.6): THREE.BufferGeometry {
  return new THREE.BoxGeometry(size, size, size);
}
