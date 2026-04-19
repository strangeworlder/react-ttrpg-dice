import * as THREE from 'three';

/**
 * Pentagonal trapezohedron (D10) — Three.js has no built-in for this shape.
 * 12 vertices: 2 poles + two offset pentagonal rings.
 * 10 kite-shaped faces, triangulated to 20 triangles.
 */
export function createD10Geometry(radius = 0.62, h = 0.5): THREE.BufferGeometry {
  const step = (2 * Math.PI) / 5;
  const off  = Math.PI / 5; // 36° offset
  const r    = radius * Math.cos(Math.PI / 5); // ≈ 0.809 * radius

  const top = new THREE.Vector3(0,  radius, 0);
  const bot = new THREE.Vector3(0, -radius, 0);

  const upper: THREE.Vector3[] = [];
  const lower: THREE.Vector3[] = [];
  for (let i = 0; i < 5; i++) {
    const a = i * step;
    upper.push(new THREE.Vector3(r * Math.sin(a),      h * radius, r * Math.cos(a)));
    lower.push(new THREE.Vector3(r * Math.sin(a + off), -h * radius, r * Math.cos(a + off)));
  }

  const positions: number[] = [];
  const normals:   number[] = [];

  function addTri(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) {
    const n = new THREE.Triangle(a, b, c).getNormal(new THREE.Vector3());
    for (const v of [a, b, c]) { positions.push(v.x, v.y, v.z); normals.push(n.x, n.y, n.z); }
  }
  function addQuad(v0: THREE.Vector3, v1: THREE.Vector3, v2: THREE.Vector3, v3: THREE.Vector3) {
    addTri(v0, v1, v2); addTri(v0, v2, v3);
  }

  for (let i = 0; i < 5; i++) {
    const n = (i + 1) % 5;
    // Upper kite: top → upper[i] → lower[i] → upper[n]
    addQuad(top, upper[i], lower[i], upper[n]);
    // Lower kite: bot → lower[n] → upper[n] → lower[i]
    addQuad(bot, lower[n], upper[n], lower[i]);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal',   new THREE.Float32BufferAttribute(normals, 3));
  return geo;
}
