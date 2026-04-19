import type { DieDefinition, RegistryId } from './types.js';

// ─── Pre-computed mathematical constants ──────────────────────────────────────
const phi = (1 + Math.sqrt(5)) / 2;   // golden ratio ≈ 1.618
const s   = 1 / Math.sqrt(3);          // ≈ 0.5774  (octahedron / icosahedron normals)
const p   = phi / Math.sqrt(3);        // ≈ 0.9342  (D20 group B/D)
const q   = 1 / phi / Math.sqrt(3);   // ≈ 0.3568  (D20 group B/D)
const L12 = Math.sqrt(1 + phi * phi); // ≈ 1.9021  (D12 normalisation)

// D10 geometry constants (h = 0.5 · radius, ring radius r ≈ 0.809)
const _rH =  0.608;  // horizontal magnitude of D10 unit face normal
const _yU =  0.796;  // y of upper D10 face normals
const _yL = -0.795;  // y of lower D10 face normals

// Helpers for D10 face normals
function d10n(az: number, y: number): [number, number, number] {
  return [_rH * Math.sin(az), y, _rH * Math.cos(az)];
}
const PI5 = Math.PI / 5; // 36°

// ─── Default definitions ────────────────────────────────────────────────────

const D4: DieDefinition = {
  id: 'd4', sides: 4, modelPath: '',
  physics: { mass: 0.8, friction: 0.7, restitution: 0.2, linearDamping: 0.5, angularDamping: 0.8 },
  // Real-world D4 convention: the face touching the floor is the result.
  // face-down finds the face whose outward normal points most toward −Y.
  // group i → shows faceValues[i], reading returns faceValues[bottom_face_i] — consistent.
  readStrategy: 'face-down',
  faceNormals:  [[s, -s, -s], [-s, -s, s], [-s, s, -s], [s, s, s]],
  faceValues:   [1, 2, 3, 4],
};

const D6: DieDefinition = {
  id: 'd6', sides: 6, modelPath: '',
  physics: { mass: 1.0, friction: 0.6, restitution: 0.3, linearDamping: 0.3, angularDamping: 0.5 },
  readStrategy: 'face-up',
  // BoxGeometry face order: +X, -X, +Y, -Y, +Z, -Z
  faceNormals: [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]],
  faceValues:  [3, 4, 6, 1, 2, 5], // opposite faces sum to 7 ⚠️ calibrate
};

const D8: DieDefinition = {
  id: 'd8', sides: 8, modelPath: '',
  physics: { mass: 1.0, friction: 0.5, restitution: 0.4, linearDamping: 0.2, angularDamping: 0.4 },
  readStrategy: 'face-up',
  faceNormals: [
    [s,s,s],[s,s,-s],[s,-s,s],[s,-s,-s],
    [-s,s,s],[-s,s,-s],[-s,-s,s],[-s,-s,-s],
  ],
  faceValues: [8,7,6,5,4,3,2,1], // opposite pairs sum to 9 ⚠️ calibrate
};

const D10_NORMALS: [number,number,number][] = [
  // 5 upper faces (azimuths 36°,108°,180°,252°,324°)
  d10n(PI5,   _yU), d10n(3*PI5, _yU), d10n(5*PI5, _yU), d10n(7*PI5, _yU), d10n(9*PI5, _yU),
  // 5 lower faces (azimuths 72°,144°,216°,288°,360°)
  d10n(2*PI5, _yL), d10n(4*PI5, _yL), d10n(6*PI5, _yL), d10n(8*PI5, _yL), d10n(10*PI5, _yL),
];

const D10: DieDefinition = {
  id: 'd10', sides: 10, modelPath: '',
  physics: { mass: 1.2, friction: 0.5, restitution: 0.35, linearDamping: 0.3, angularDamping: 0.5 },
  readStrategy: 'face-up',
  faceNormals: D10_NORMALS,
  // 0–9; face "0" treated as 10 in standalone context ⚠️ calibrate
  faceValues: [0,1,2,3,4,5,6,7,8,9],
};

const D10_TENS: DieDefinition = {
  ...D10, id: 'd10-tens',
  faceValues: [0,10,20,30,40,50,60,70,80,90],
};

const D12: DieDefinition = {
  id: 'd12', sides: 12, modelPath: '',
  physics: { mass: 1.5, friction: 0.45, restitution: 0.35, linearDamping: 0.2, angularDamping: 0.4 },
  readStrategy: 'face-up',
  // Normals = icosahedron vertex directions / L12 ⚠️ calibrate
  faceNormals: [
    [0, 1/L12, phi/L12], [0,-1/L12, phi/L12],
    [0, 1/L12,-phi/L12], [0,-1/L12,-phi/L12],
    [ 1/L12, phi/L12,0], [-1/L12, phi/L12,0],
    [ 1/L12,-phi/L12,0], [-1/L12,-phi/L12,0],
    [ phi/L12,0, 1/L12], [ phi/L12,0,-1/L12],
    [-phi/L12,0, 1/L12], [-phi/L12,0,-1/L12],
  ],
  faceValues: [1,2,11,12,3,5,8,10,4,9,7,6], // ⚠️ calibrate
};

const D20: DieDefinition = {
  id: 'd20', sides: 20, modelPath: '',
  physics: { mass: 2.0, friction: 0.4, restitution: 0.3, linearDamping: 0.1, angularDamping: 0.3 },
  readStrategy: 'face-up',
  // Normals = dodecahedron vertex directions (all magnitude √3, so /√3 = unit vectors)
  faceNormals: [
    // Group A: (±s,±s,±s)
    [s,s,s],[s,s,-s],[s,-s,s],[s,-s,-s],[-s,s,s],[-s,s,-s],[-s,-s,s],[-s,-s,-s],
    // Group B: (0,±p,±q)
    [0,p,q],[0,p,-q],[0,-p,q],[0,-p,-q],
    // Group C: (±q,0,±p)
    [q,0,p],[q,0,-p],[-q,0,p],[-q,0,-p],
    // Group D: (±p,±q,0)
    [p,q,0],[p,-q,0],[-p,q,0],[-p,-q,0],
  ],
  // Opposite pairs sum to 21 ⚠️ calibrate against GLB
  faceValues: [1,2,3,4,17,18,19,20, 5,6,15,16, 7,8,13,14, 9,12,11,10],
};

const DEFAULTS: DieDefinition[] = [D4, D6, D8, D10, D10_TENS, D12, D20];

// ─── Registry ────────────────────────────────────────────────────────────────

export class DieRegistry {
  private readonly map: Map<string, DieDefinition>;

  constructor(custom?: DieDefinition[]) {
    this.map = new Map(DEFAULTS.map(d => [d.id, d]));
    custom?.forEach(d => this.map.set(d.id, d));
  }

  get(id: string): DieDefinition {
    const def = this.map.get(id);
    if (!def) throw new Error(`Die not found in registry: "${id}"`);
    return def;
  }

  has(id: string): boolean { return this.map.has(id); }
  register(d: DieDefinition): void { this.map.set(d.id, d); }
}
