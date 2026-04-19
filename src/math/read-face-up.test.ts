import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { readFaceUp } from './read-face-up.js';

// D6 test data (BoxGeometry order: +X,-X,+Y,-Y,+Z,-Z)
const NORMALS: [number,number,number][] = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
const VALUES = [3,4,6,1,2,5];

const q = (x: number, y: number, z: number) =>
  new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z));

describe('readFaceUp — D6', () => {
  it('identity → top face (+Y) = 6', () => {
    const r = readFaceUp(new THREE.Quaternion(), NORMALS, VALUES);
    expect(r.value).toBe(6);
    expect(r.confidence).toBeCloseTo(1, 5);
  });

  it('180° X → bottom face becomes top = 1', () => {
    expect(readFaceUp(q(Math.PI, 0, 0), NORMALS, VALUES).value).toBe(1);
  });

  it('-90° X → +Z comes to top = 2', () => {
    expect(readFaceUp(q(-Math.PI/2, 0, 0), NORMALS, VALUES).value).toBe(2);
  });

  it('+90° X → -Z comes to top = 5', () => {
    expect(readFaceUp(q(Math.PI/2, 0, 0), NORMALS, VALUES).value).toBe(5);
  });

  it('-90° Z → -X face comes to top = 4', () => {
    // Rotating around Z by -PI/2 tilts +Y toward -X, so -X face (value 4) faces up
    expect(readFaceUp(q(0, 0, -Math.PI/2), NORMALS, VALUES).value).toBe(4);
  });

  it('+90° Z → +X face comes to top = 3', () => {
    // Rotating around Z by +PI/2 tilts +Y toward +X, so +X face (value 3) faces up
    expect(readFaceUp(q(0, 0, Math.PI/2), NORMALS, VALUES).value).toBe(3);
  });

  it('slight tilt reduces confidence below 1', () => {
    const r = readFaceUp(q(0.1, 0, 0), NORMALS, VALUES);
    expect(r.confidence).toBeLessThan(1);
    expect(r.confidence).toBeGreaterThan(0.98);
  });
});
