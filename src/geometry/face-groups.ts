import * as THREE from 'three';

// Cached geometry-derived face normals (computed once per die type)
const _normalCache = new Map<string, [number, number, number][]>();
import type { RegistryId } from '../types.js';
import { getDieGeometry } from './die-model-loader.js';

// ─── Triangles per physical face ─────────────────────────────────────────────
// -1 means "already has groups" (BoxGeometry)
const TRIS_PER_FACE: Record<string, number> = {
  'd4':       1,  // TetrahedronGeometry: 4 triangular faces
  'd6':      -1,  // BoxGeometry: 6 groups already built-in
  'd8':       1,  // OctahedronGeometry: 8 triangular faces
  'd10':      2,  // Custom D10: 10 kite faces (2 triangles per face)
  'd10-tens': 2,
  'd12':      3,  // DodecahedronGeometry: 12 pentagonal faces (3 tris each)
  'd20':      1,  // IcosahedronGeometry: 20 triangular faces
};

// ─── Per-triangle UV tables ───────────────────────────────────────────────────
// For 1-triangle face: UV centroid = (0.5, 0.5) ✓
const UV_1: [number, number][][] = [
  [[0.5, 1.0], [0.0, 0.25], [1.0, 0.25]],
];

// For 2-triangle face (fan from v0 — kite/diamond shape):
// combined centroid = (0.5, 0.5) ✓
const UV_2: [number, number][][] = [
  [[0.5, 1.0], [0.0, 0.5], [0.5, 0.0]],  // tri 0
  [[0.5, 1.0], [0.5, 0.0], [1.0, 0.5]],  // tri 1
];


const UV_TABLE: Record<number, [number, number][][]> = { 1: UV_1, 2: UV_2 };

// ─── Geometry cache ───────────────────────────────────────────────────────────
const _cache = new Map<string, THREE.BufferGeometry>();

/**
 * Computes UV coordinates by projecting each face group's 3D vertices onto the
 * face plane. Guarantees centroid → UV(0.5, 0.5) with uniform scale and margin.
 * Works for any polygon shape — no assumption about winding order.
 */
function computePlanarUVs(geo: THREE.BufferGeometry): void {
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const uv  = geo.attributes.uv as THREE.BufferAttribute;

  const _v = new THREE.Vector3();
  const _centroid = new THREE.Vector3();
  const _a = new THREE.Vector3();
  const _b = new THREE.Vector3();
  const _c = new THREE.Vector3();
  const _normal = new THREE.Vector3();
  const _tangent = new THREE.Vector3();
  const _bitangent = new THREE.Vector3();

  for (const group of geo.groups) {
    const start = group.start;
    const count = group.count;

    // 1. Centroid
    _centroid.set(0, 0, 0);
    for (let i = 0; i < count; i++) {
      _v.fromBufferAttribute(pos, start + i);
      _centroid.add(_v);
    }
    _centroid.divideScalar(count);

    // 2. Face normal from first triangle
    _a.fromBufferAttribute(pos, start);
    _b.fromBufferAttribute(pos, start + 1);
    _c.fromBufferAttribute(pos, start + 2);
    _normal.crossVectors(
      new THREE.Vector3().subVectors(_b, _a),
      new THREE.Vector3().subVectors(_c, _a),
    ).normalize();
    if (_normal.dot(_centroid) < 0) _normal.negate();

    // 3. Tangent frame (Gram-Schmidt from least-aligned world axis)
    const ax = Math.abs(_normal.x), ay = Math.abs(_normal.y), az = Math.abs(_normal.z);
    if (ax <= ay && ax <= az) _tangent.set(1, 0, 0);
    else if (ay <= az) _tangent.set(0, 1, 0);
    else _tangent.set(0, 0, 1);
    _tangent.addScaledVector(_normal, -_normal.dot(_tangent)).normalize();
    _bitangent.crossVectors(_normal, _tangent);

    // 4. Project to 2D and find bounds
    const coords: [number, number][] = [];
    for (let i = 0; i < count; i++) {
      _v.fromBufferAttribute(pos, start + i).sub(_centroid);
      coords.push([_v.dot(_tangent), _v.dot(_bitangent)]);
    }

    let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
    for (const [cu, cv] of coords) {
      if (cu < minU) minU = cu; if (cu > maxU) maxU = cu;
      if (cv < minV) minV = cv; if (cv > maxV) maxV = cv;
    }

    // 5. Normalize to [margin, 1-margin] with uniform scale
    const range  = Math.max(maxU - minU, maxV - minV) || 1;
    const margin = 0.08;
    const scale  = (1 - 2 * margin) / range;

    for (let i = 0; i < count; i++) {
      const [cu, cv] = coords[i];
      uv.setXY(start + i, 0.5 + cu * scale, 0.5 + cv * scale);
    }
  }

  uv.needsUpdate = true;
}

/**
 * Returns a geometry for the given die type split into per-face groups + UV.
 * Cached — safe to call from multiple DieMesh instances.
 */
export function getGroupedGeometry(id: RegistryId): THREE.BufferGeometry {
  if (_cache.has(id)) return _cache.get(id)!;

  const base = getDieGeometry(id);
  const tpf = TRIS_PER_FACE[id];

  if (tpf === -1) {
    // BoxGeometry already has 6 groups with correct [0,1]×[0,1] UV per face
    _cache.set(id, base);
    return base;
  }

  const t = tpf ?? 1;
  const geo = base.toNonIndexed();
  const totalVerts = geo.attributes.position.count;
  const faceCount = Math.round(totalVerts / (t * 3));

  // Add groups first (computePlanarUVs iterates over geo.groups)
  for (let face = 0; face < faceCount; face++) {
    geo.addGroup(face * t * 3, t * 3, face);
  }

  // Assign UV coordinates
  const uvArr = new Float32Array(totalVerts * 2);

  if (id === 'd12') {
    // Computed UVs need the attribute to exist first (setXY writes to it)
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvArr, 2));
    computePlanarUVs(geo);
  } else {
    // Fill array first, then create the attribute (matches original working pattern)
    const uvTable = UV_TABLE[t] ?? UV_1;
    for (let face = 0; face < faceCount; face++) {
      for (let tri = 0; tri < t; tri++) {
        const triUVs = uvTable[tri];
        for (let v = 0; v < 3; v++) {
          const vi = (face * t + tri) * 3 + v;
          uvArr[vi * 2]     = triUVs[v][0];
          uvArr[vi * 2 + 1] = triUVs[v][1];
        }
      }
    }
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvArr, 2));
  }

  geo.computeVertexNormals();
  _cache.set(id, geo);
  return geo;
}

export function disposeGroupedGeometries(): void {
  _cache.forEach(g => g.dispose());
  _cache.clear();
  _normalCache.clear();
}

/**
 * Extracts the actual outward face normal for each group from the geometry's
 * vertex positions (cross-product of two edges of the first triangle in the group).
 *
 * Handles BOTH indexed geometries (e.g. BoxGeometry — uses index buffer)
 * and non-indexed (e.g. after toNonIndexed — uses position buffer directly).
 *
 * Normals are guaranteed to point outward (away from origin) via centroid check.
 *
 * Guaranteed to align with getDieFaceMaterials(id) — both use group index i,
 * so normals[i] is the normal of the same physical face as materials[i].
 */
export function extractFaceNormals(id: RegistryId): [number, number, number][] {
  if (_normalCache.has(id)) return _normalCache.get(id)!;

  const geo = getGroupedGeometry(id);
  const pos   = geo.attributes.position as THREE.BufferAttribute;
  const index = geo.index; // null for non-indexed geometries
  const normals: [number, number, number][] = [];

  const a     = new THREE.Vector3();
  const b     = new THREE.Vector3();
  const c     = new THREE.Vector3();
  const edge1 = new THREE.Vector3();
  const edge2 = new THREE.Vector3();
  const n     = new THREE.Vector3();
  const faceNormal = new THREE.Vector3();

  for (const group of geo.groups) {
    faceNormal.set(0, 0, 0);
    const triCount = group.count / 3;

    for (let i = 0; i < triCount; i++) {
      let vi0: number, vi1: number, vi2: number;
      const offset = group.start + i * 3;

      if (index) {
        vi0 = index.getX(offset);
        vi1 = index.getX(offset + 1);
        vi2 = index.getX(offset + 2);
      } else {
        vi0 = offset;
        vi1 = offset + 1;
        vi2 = offset + 2;
      }

      a.fromBufferAttribute(pos, vi0);
      b.fromBufferAttribute(pos, vi1);
      c.fromBufferAttribute(pos, vi2);
      edge1.subVectors(b, a);
      edge2.subVectors(c, a);
      // Normalize BEFORE adding — equal-weight unit-normal average.
      // Area-weighting (adding raw cross products) would keep the bias because
      // the D10's first sub-triangle is ~3× larger than its second, making the
      // area-weighted result nearly identical to the first-triangle-only result.
      n.crossVectors(edge1, edge2).normalize();
      if (!isNaN(n.x)) faceNormal.add(n);
    }

    faceNormal.normalize();

    // Ensure normal points OUTWARD from the die center (origin).
    // Centroid of the first triangle in the group is sufficient for the check.
    const vi0 = index ? index.getX(group.start) : group.start;
    const vi1 = index ? index.getX(group.start + 1) : group.start + 1;
    const vi2 = index ? index.getX(group.start + 2) : group.start + 2;
    a.fromBufferAttribute(pos, vi0);
    b.fromBufferAttribute(pos, vi1);
    c.fromBufferAttribute(pos, vi2);
    const cx = (a.x + b.x + c.x) / 3;
    const cy = (a.y + b.y + c.y) / 3;
    const cz = (a.z + b.z + c.z) / 3;
    if (faceNormal.x * cx + faceNormal.y * cy + faceNormal.z * cz < 0) {
      faceNormal.negate();
    }

    normals.push([faceNormal.x, faceNormal.y, faceNormal.z]);
  }

  _normalCache.set(id, normals);
  return normals;
}
