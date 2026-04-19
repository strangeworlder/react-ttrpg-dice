import * as THREE from 'three';
import type { DieDefinition } from '../types.js';
import type { ThemeDefinition } from '../themes/theme-definitions.js';

// ─── Canvas texture cache (by visual identity) ───────────────────────────────
const _texCache = new Map<string, THREE.CanvasTexture>();
const _emiCache = new Map<string, THREE.CanvasTexture>();
const _matCache = new Map<string, THREE.MeshPhysicalMaterial[] | THREE.MeshStandardMaterial[]>();

/** Content-based fingerprint so custom color overrides produce distinct cache keys */
function themeFingerprint(theme: ThemeDefinition): string {
  return `${theme.dieColor}_${theme.numberColor}_${theme.accentColor}_${theme.roughness}_${theme.metalness}_${theme.isGlass ? 1 : 0}`;
}

// High-res canvas for crisp rendering at any die display size
const SIZE = 512;

/**
 * Draws the die-colour background + accent circle + number.
 * This is the albedo texture — gives the face its base colour.
 */
function createAlbedoCanvas(value: number, theme: ThemeDefinition): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d')!;

  // --- Background ---
  if (theme.isGlass) {
    ctx.fillStyle = 'rgba(200, 225, 255, 0.30)';
  } else {
    ctx.fillStyle = theme.dieColor;
  }
  ctx.fillRect(0, 0, SIZE, SIZE);

  // --- Filled dark circle behind the number (contrast pad) ---
  ctx.beginPath();
  ctx.arc(SIZE / 2, SIZE / 2, SIZE * 0.36, 0, Math.PI * 2);
  ctx.fillStyle = theme.isGlass ? 'rgba(10,20,60,0.15)' : 'rgba(0,0,0,0.30)';
  ctx.fill();

  // --- Accent circle border ---
  ctx.strokeStyle = theme.accentColor;
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(SIZE / 2, SIZE / 2, SIZE * 0.36, 0, Math.PI * 2);
  ctx.stroke();

  // --- Number ---
  const label = String(value === 0 ? '0' : value);
  const fontSize = label.length >= 2 ? 210 : 260;
  ctx.font = `900 ${fontSize}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Dark outline for contrast on any background
  ctx.strokeStyle = theme.isGlass ? 'rgba(0,10,40,0.6)' : 'rgba(0,0,0,0.55)';
  ctx.lineWidth = 14;
  ctx.lineJoin = 'round';
  ctx.strokeText(label, SIZE / 2, SIZE / 2 + 10);

  ctx.fillStyle = theme.isGlass ? '#0d1f3c' : theme.numberColor;
  ctx.fillText(label, SIZE / 2, SIZE / 2 + 10);

  // Underline 6 and 9 (standard dice disambiguation)
  if (value === 6 || value === 9) {
    const w = ctx.measureText(label).width;
    ctx.strokeStyle = theme.isGlass ? '#0d1f3c' : theme.numberColor;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(SIZE / 2 - w / 2, SIZE / 2 + 80);
    ctx.lineTo(SIZE / 2 + w / 2, SIZE / 2 + 80);
    ctx.stroke();
  }

  return canvas;
}

/**
 * Creates an emissive mask canvas: white number + circle border on black.
 * Used as emissiveMap so numbers glow self-luminously regardless of metalness,
 * roughness, or light direction — albedo textures alone are washed out on
 * highly reflective PBR surfaces.
 */
function createEmissiveCanvas(value: number, theme: ThemeDefinition): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, SIZE, SIZE);

  // Subtle circle glow
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 6;
  ctx.globalAlpha = 0.35;
  ctx.beginPath();
  ctx.arc(SIZE / 2, SIZE / 2, SIZE * 0.36, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1.0;

  const label = String(value === 0 ? '0' : value);
  const fontSize = label.length >= 2 ? 210 : 260;
  ctx.font = `900 ${fontSize}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(label, SIZE / 2, SIZE / 2 + 10);

  if (value === 6 || value === 9) {
    const w = ctx.measureText(label).width;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(SIZE / 2 - w / 2, SIZE / 2 + 80);
    ctx.lineTo(SIZE / 2 + w / 2, SIZE / 2 + 80);
    ctx.stroke();
  }

  return canvas;
}

function getAlbedoTexture(value: number, theme: ThemeDefinition): THREE.CanvasTexture {
  const key = `${value}__${themeFingerprint(theme)}`;
  if (_texCache.has(key)) return _texCache.get(key)!;
  const tex = new THREE.CanvasTexture(createAlbedoCanvas(value, theme));
  tex.needsUpdate = true;
  _texCache.set(key, tex);
  return tex;
}

function getEmissiveTexture(value: number, theme: ThemeDefinition): THREE.CanvasTexture {
  const key = `${value}__${themeFingerprint(theme)}`;
  if (_emiCache.has(key)) return _emiCache.get(key)!;
  const tex = new THREE.CanvasTexture(createEmissiveCanvas(value, theme));
  tex.needsUpdate = true;
  _emiCache.set(key, tex);
  return tex;
}

// ─── D4 corner-number topology ──────────────────────────────────────────────
// Three.js TetrahedronGeometry(r, 0) indices: [2,1,0, 0,3,2, 1,3,0, 2,3,1]
// Face i has these original vertex indices:
const D4_FACE_VERTS = [[2,1,0], [0,3,2], [1,3,0], [2,3,1]];
// Vertex i is opposite face D4_VERT_OPP[i] (the face that does NOT contain vertex i):
const D4_VERT_OPP = [3, 1, 2, 0];

// Canvas positions for the 3 corners, inset from UV_1 triangle vertices toward centroid.
// UV_1: (0.5,1.0)→canvas top(256,0), (0.0,0.25)→bl(0,384), (1.0,0.25)→br(512,384)
// Centroid = (256,256). Positions are ~35% inset from vertex toward centroid.
const D4_CORNER: [number, number][] = [
  [SIZE * 0.78, SIZE * 0.62],  // bottom-right (rotated CW from top)
  [SIZE * 0.50, SIZE * 0.22],  // top (rotated CW from bottom-left)
  [SIZE * 0.22, SIZE * 0.62],  // bottom-left (rotated CW from bottom-right)
];

// Pre-compute rotation angles: each number's bottom points toward the face centroid
const D4_CX = SIZE * 0.50, D4_CY = SIZE * 0.50; // UV triangle centroid in canvas space
const D4_ANGLE = D4_CORNER.map(([x, y]) =>
  Math.atan2(D4_CY - y, D4_CX - x) - Math.PI / 2,
);

function createD4AlbedoCanvas(
  faceIndex: number, faceValues: number[], theme: ThemeDefinition,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE; canvas.height = SIZE;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = theme.isGlass ? 'rgba(200, 225, 255, 0.30)' : theme.dieColor;
  ctx.fillRect(0, 0, SIZE, SIZE);

  const verts = D4_FACE_VERTS[faceIndex];
  ctx.font = `900 160px "Helvetica Neue", Helvetica, Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (let i = 0; i < 3; i++) {
    const value = faceValues[D4_VERT_OPP[verts[i]]];
    const [x, y] = D4_CORNER[i];
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(D4_ANGLE[i]);
    ctx.strokeStyle = theme.isGlass ? 'rgba(0,10,40,0.7)' : 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 14;
    ctx.lineJoin = 'round';
    ctx.strokeText(String(value), 0, 0);
    ctx.fillStyle = theme.isGlass ? '#0d1f3c' : theme.numberColor;
    ctx.fillText(String(value), 0, 0);
    ctx.restore();
  }
  return canvas;
}

function createD4EmissiveCanvas(
  faceIndex: number, faceValues: number[],
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE; canvas.height = SIZE;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, SIZE, SIZE);

  const verts = D4_FACE_VERTS[faceIndex];
  ctx.font = `900 160px "Helvetica Neue", Helvetica, Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';

  for (let i = 0; i < 3; i++) {
    const value = faceValues[D4_VERT_OPP[verts[i]]];
    const [x, y] = D4_CORNER[i];
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(D4_ANGLE[i]);
    ctx.fillText(String(value), 0, 0);
    ctx.restore();
  }
  return canvas;
}

/**
 * Returns an array of materials — one per face group — for the given die.
 * Numbers are rendered as both an albedo map (base colour) and an emissive
 * map (self-luminous glow) so they remain legible on metallic/glass surfaces.
 * Materials are cached by {registryId + theme}.
 */
export function getDieFaceMaterials(
  definition: DieDefinition,
  theme: ThemeDefinition,
): THREE.MeshPhysicalMaterial[] | THREE.MeshStandardMaterial[] {
  const key = `${definition.id}__${themeFingerprint(theme)}`;
  if (_matCache.has(key)) return _matCache.get(key)!;

  let mats: THREE.MeshPhysicalMaterial[] | THREE.MeshStandardMaterial[];

  // ─── D4: standard corner-number convention ──────────────────────────────
  if (definition.id === 'd4') {
    if (theme.isGlass) {
      mats = definition.faceValues.map((_, fi) =>
        new THREE.MeshPhysicalMaterial({
          map:             new THREE.CanvasTexture(createD4AlbedoCanvas(fi, definition.faceValues, theme)),
          color:           '#c8e0ff',
          roughness:       theme.roughness,
          metalness:       theme.metalness,
          transmission:    theme.transmission ?? 0.88,
          ior:             theme.ior ?? 1.5,
          thickness:       1.5,
          envMapIntensity: 2.0,
          emissiveMap:     new THREE.CanvasTexture(createD4EmissiveCanvas(fi, definition.faceValues)),
          emissive:        new THREE.Color(0.05, 0.10, 0.25),
          emissiveIntensity: 0.6,
          side:            THREE.FrontSide,
        }),
      );
    } else {
      mats = definition.faceValues.map((_, fi) =>
        new THREE.MeshStandardMaterial({
          map:             new THREE.CanvasTexture(createD4AlbedoCanvas(fi, definition.faceValues, theme)),
          roughness:       theme.roughness,
          metalness:       theme.metalness,
          emissiveMap:     new THREE.CanvasTexture(createD4EmissiveCanvas(fi, definition.faceValues)),
          emissive:        new THREE.Color(theme.numberColor),
          emissiveIntensity: 0.9,
          side:            THREE.FrontSide,
        }),
      );
    }
    _matCache.set(key, mats);
    return mats;
  }

  if (theme.isGlass) {
    mats = definition.faceValues.map(value =>
      new THREE.MeshPhysicalMaterial({
        map:             getAlbedoTexture(value, theme),
        color:           '#c8e0ff',
        roughness:       theme.roughness,
        metalness:       theme.metalness,
        transmission:    theme.transmission ?? 0.88,
        ior:             theme.ior ?? 1.5,
        thickness:       1.5,
        envMapIntensity: 2.0,
        // Emissive: dark-navy numbers still glow faintly so they read on glass
        emissiveMap:     getEmissiveTexture(value, theme),
        emissive:        new THREE.Color(0.05, 0.10, 0.25),
        emissiveIntensity: 0.6,
        side:            THREE.FrontSide,
      }),
    );
  } else {
    mats = definition.faceValues.map(value =>
      new THREE.MeshStandardMaterial({
        map:             getAlbedoTexture(value, theme),
        roughness:       theme.roughness,
        metalness:       theme.metalness,
        // Emissive layer: numbers glow in their accent colour regardless of
        // surface reflectivity — critical for high-metalness / low-roughness themes.
        emissiveMap:     getEmissiveTexture(value, theme),
        emissive:        new THREE.Color(theme.numberColor),
        emissiveIntensity: 0.9,
        side:            THREE.FrontSide,
      }),
    );
  }

  _matCache.set(key, mats);
  return mats;
}

export function disposeFaceTextures(): void {
  _texCache.forEach(t => t.dispose());
  _texCache.clear();
  _emiCache.forEach(t => t.dispose());
  _emiCache.clear();
  _matCache.forEach(mats => mats.forEach(m => { m.map?.dispose(); (m as THREE.MeshStandardMaterial).emissiveMap?.dispose(); m.dispose(); }));
  _matCache.clear();
}
