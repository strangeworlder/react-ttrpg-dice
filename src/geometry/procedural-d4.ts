import * as THREE from 'three';

const _s = 1 / Math.sqrt(3);
/** Vertex positions normalised to unit sphere — match Three.js TetrahedronGeometry */
export const D4_VERTEX_POSITIONS: [number,number,number][] = (
  [[1,1,1],[-1,-1,1],[-1,1,-1],[1,-1,-1]] as [number,number,number][]
).map(([x,y,z]) => { const l=Math.sqrt(x*x+y*y+z*z); return [x/l,y/l,z/l]; }) as [number,number,number][];

export function createD4Geometry(radius = 0.65): THREE.BufferGeometry {
  return new THREE.TetrahedronGeometry(radius, 0);
}
