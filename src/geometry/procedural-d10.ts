import * as THREE from 'three';

/**
 * Traditional pentagonal trapezohedron (D10).
 *
 * 12 vertices: 2 apex poles + two offset pentagonal rings.
 * 10 kite-shaped faces, triangulated to 20 triangles.
 *
 * The proportions enforce a critical geometric constraint so that each
 * kite face is perfectly planar (all 4 vertices coplanar):
 *
 *     ringY / poleY  =  (1 − cos 36°) / (1 + cos 36°)  ≈  0.1056
 *
 * Without this ratio the quad is "bent" along its diagonal, producing a
 * visible crease on each face.  With it every face is a true flat kite —
 * exactly like a real injection-moulded d10.
 *
 * Overall sizing targets a bounding radius of ≈ 0.60 so the d10 sits
 * visually alongside d8 (0.65), d12 (0.65), d4 (0.65), etc.
 */
export function createD10Geometry(): THREE.BufferGeometry {
  // ── Sizing ────────────────────────────────────────────────────────────────
  // ringR  — equatorial radius (widest point of the die)
  // poleY  — half-height (apex above/below origin)
  // ringY  — derived from poleY via the planarity constraint
  const ringR = 0.54;
  const poleY = 0.58;
  const ringY = poleY * (1 - Math.cos(Math.PI / 5)) / (1 + Math.cos(Math.PI / 5));
  // ringY ≈ 0.0613  — rings sit very close to the equator, which is correct:
  // a real d10 has its widest band of vertices near the middle.

  const step = (2 * Math.PI) / 5;
  const off  = Math.PI / 5; // 36° offset between upper and lower ring

  const top = new THREE.Vector3(0,  poleY, 0);
  const bot = new THREE.Vector3(0, -poleY, 0);

  const upper: THREE.Vector3[] = [];
  const lower: THREE.Vector3[] = [];
  for (let i = 0; i < 5; i++) {
    const a = i * step;
    upper.push(new THREE.Vector3(ringR * Math.sin(a),       ringY, ringR * Math.cos(a)));
    lower.push(new THREE.Vector3(ringR * Math.sin(a + off), -ringY, ringR * Math.cos(a + off)));
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
