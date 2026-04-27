import * as THREE from 'three';
import type { DieDefinition } from '../types.js';
import type { ThemeDefinition } from '../themes/theme-definitions.js';
import { pickRandomGlyph } from './scramble-glyphs.js';

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

// ─── Material factory ─────────────────────────────────────────────────────────
// Unified constructor that handles both glass (MeshPhysicalMaterial) and
// standard (MeshStandardMaterial) paths, eliminating 6 duplicate branches.

interface FaceMaterialOpts {
  theme: ThemeDefinition;
  map: THREE.Texture;
  emissiveMap: THREE.Texture;
  emissive: THREE.Color;
  emissiveIntensity: number;
}

function createFaceMaterial(
  opts: FaceMaterialOpts,
): THREE.MeshPhysicalMaterial | THREE.MeshStandardMaterial {
  const base = {
    map:               opts.map,
    roughness:         opts.theme.roughness,
    metalness:         opts.theme.metalness,
    emissiveMap:       opts.emissiveMap,
    emissive:          opts.emissive,
    emissiveIntensity: opts.emissiveIntensity,
    side:              THREE.FrontSide as THREE.Side,
  };

  if (opts.theme.isGlass) {
    return new THREE.MeshPhysicalMaterial({
      ...base,
      color:           '#c8e0ff',
      transmission:    opts.theme.transmission ?? 0.88,
      ior:             opts.theme.ior ?? 1.5,
      thickness:       1.5,
      envMapIntensity: 2.0,
    });
  }

  return new THREE.MeshStandardMaterial(base);
}

/** Emissive colour for glass themes: dark navy */
const GLASS_EMISSIVE = new THREE.Color(0.05, 0.10, 0.25);
const GLASS_EMISSIVE_INTENSITY = 0.6;
const OPAQUE_EMISSIVE_INTENSITY = 0.9;

function emissiveFor(theme: ThemeDefinition): THREE.Color {
  return theme.isGlass ? GLASS_EMISSIVE.clone() : new THREE.Color(theme.numberColor);
}

function emissiveIntensityFor(theme: ThemeDefinition): number {
  return theme.isGlass ? GLASS_EMISSIVE_INTENSITY : OPAQUE_EMISSIVE_INTENSITY;
}

function tex(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(canvas);
  t.needsUpdate = true;
  return t;
}

// ─── Canvas drawing helpers ───────────────────────────────────────────────────
// Shared logic for background, circle pad, number rendering, and
// 6/9 underline disambiguation.

function fillBackground(ctx: CanvasRenderingContext2D, theme: ThemeDefinition): void {
  ctx.fillStyle = theme.isGlass ? 'rgba(200, 225, 255, 0.30)' : theme.dieColor;
  ctx.fillRect(0, 0, SIZE, SIZE);
}

function drawCirclePad(ctx: CanvasRenderingContext2D, theme: ThemeDefinition): void {
  ctx.beginPath();
  ctx.arc(SIZE / 2, SIZE / 2, SIZE * 0.36, 0, Math.PI * 2);
  ctx.fillStyle = theme.isGlass ? 'rgba(10,20,60,0.15)' : 'rgba(0,0,0,0.30)';
  ctx.fill();
}

function drawAccentCircle(ctx: CanvasRenderingContext2D, theme: ThemeDefinition): void {
  ctx.strokeStyle = theme.accentColor;
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(SIZE / 2, SIZE / 2, SIZE * 0.36, 0, Math.PI * 2);
  ctx.stroke();
}

function drawCenteredText(
  ctx: CanvasRenderingContext2D,
  label: string,
  theme: ThemeDefinition,
  fontSize: number,
  fontFamily: string,
): void {
  ctx.font = `900 ${fontSize}px ${fontFamily}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Dark outline for contrast on any background
  ctx.strokeStyle = theme.isGlass ? 'rgba(0,10,40,0.6)' : 'rgba(0,0,0,0.55)';
  ctx.lineWidth = 14;
  ctx.lineJoin = 'round';
  ctx.strokeText(label, SIZE / 2, SIZE / 2 + 10);

  ctx.fillStyle = theme.isGlass ? '#0d1f3c' : theme.numberColor;
  ctx.fillText(label, SIZE / 2, SIZE / 2 + 10);
}

function drawUnderline69(ctx: CanvasRenderingContext2D, value: number, theme: ThemeDefinition): void {
  if (value !== 6 && value !== 9) return;
  const label = String(value);
  const w = ctx.measureText(label).width;
  ctx.strokeStyle = theme.isGlass ? '#0d1f3c' : theme.numberColor;
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(SIZE / 2 - w / 2, SIZE / 2 + 80);
  ctx.lineTo(SIZE / 2 + w / 2, SIZE / 2 + 80);
  ctx.stroke();
}

const SANS_FONT = '"Helvetica Neue", Helvetica, Arial, sans-serif';
const SYMBOL_FONT = '"Segoe UI Symbol", "Noto Sans Symbols", "Noto Sans Symbols 2", sans-serif';

// ─── Standard face canvases (non-D4) ─────────────────────────────────────────

function createAlbedoCanvas(value: number, theme: ThemeDefinition, fontScale = 1): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d')!;

  fillBackground(ctx, theme);
  drawCirclePad(ctx, theme);
  drawAccentCircle(ctx, theme);

  const label = String(value === 0 ? '0' : value);
  const fontSize = Math.round((label.length >= 2 ? 210 : 260) * fontScale);
  if (fontScale < 1) ctx.letterSpacing = '-0.2px';
  drawCenteredText(ctx, label, theme, fontSize, SANS_FONT);
  drawUnderline69(ctx, value, theme);

  return canvas;
}

function createEmissiveCanvas(value: number, _theme: ThemeDefinition, fontScale = 1): HTMLCanvasElement {
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
  const fontSize = Math.round((label.length >= 2 ? 210 : 260) * fontScale);
  ctx.font = `900 ${fontSize}px ${SANS_FONT}`;
  if (fontScale < 1) ctx.letterSpacing = '-0.2px';
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

function getAlbedoTexture(value: number, theme: ThemeDefinition, fontScale = 1): THREE.CanvasTexture {
  const key = `${value}__${themeFingerprint(theme)}__${fontScale}`;
  if (_texCache.has(key)) return _texCache.get(key)!;
  const t = tex(createAlbedoCanvas(value, theme, fontScale));
  _texCache.set(key, t);
  return t;
}

function getEmissiveTexture(value: number, theme: ThemeDefinition, fontScale = 1): THREE.CanvasTexture {
  const key = `${value}__${themeFingerprint(theme)}__${fontScale}`;
  if (_emiCache.has(key)) return _emiCache.get(key)!;
  const t = tex(createEmissiveCanvas(value, theme, fontScale));
  _emiCache.set(key, t);
  return t;
}

// ─── D4 corner-number topology ──────────────────────────────────────────────
// Three.js TetrahedronGeometry(r, 0) indices: [2,1,0, 0,3,2, 1,3,0, 2,3,1]
// Face i has these original vertex indices:
const D4_FACE_VERTS = [[2,1,0], [0,3,2], [1,3,0], [2,3,1]];
// Vertex i is opposite face D4_VERT_OPP[i] (the face that does NOT contain vertex i):
const D4_VERT_OPP = [3, 1, 2, 0];

// Canvas positions for the 3 corners, inset from UV_1 triangle vertices toward centroid.
const D4_CORNER: [number, number][] = [
  [SIZE * 0.78, SIZE * 0.62],
  [SIZE * 0.50, SIZE * 0.22],
  [SIZE * 0.22, SIZE * 0.62],
];

// Pre-compute rotation angles: each number's bottom points toward the face centroid
const D4_CX = SIZE * 0.50, D4_CY = SIZE * 0.50;
const D4_ANGLE = D4_CORNER.map(([x, y]) =>
  Math.atan2(D4_CY - y, D4_CX - x) - Math.PI / 2,
);

function createD4AlbedoCanvas(
  faceIndex: number, faceValues: number[], theme: ThemeDefinition,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE; canvas.height = SIZE;
  const ctx = canvas.getContext('2d')!;

  fillBackground(ctx, theme);

  const verts = D4_FACE_VERTS[faceIndex];
  ctx.font = `900 160px ${SANS_FONT}`;
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
  ctx.font = `900 160px ${SANS_FONT}`;
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

// ─── Main public API: per-face materials ────────────────────────────────────

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
    mats = definition.faceValues.map((_, fi) =>
      createFaceMaterial({
        theme,
        map:               tex(createD4AlbedoCanvas(fi, definition.faceValues, theme)),
        emissiveMap:       tex(createD4EmissiveCanvas(fi, definition.faceValues)),
        emissive:          emissiveFor(theme),
        emissiveIntensity: emissiveIntensityFor(theme),
      }),
    );
    _matCache.set(key, mats);
    return mats;
  }

  // d10-tens (percentile): slightly smaller font for readability on kite faces
  const fontScale = definition.id === 'd10-tens' ? 0.95 : 1;

  mats = definition.faceValues.map(value =>
    createFaceMaterial({
      theme,
      map:               getAlbedoTexture(value, theme, fontScale),
      emissiveMap:       getEmissiveTexture(value, theme, fontScale),
      emissive:          emissiveFor(theme),
      emissiveIntensity: emissiveIntensityFor(theme),
    }),
  );

  _matCache.set(key, mats);
  return mats;
}

// ─── Scrambled face materials (predetermined roll animation) ────────────────

/**
 * Creates a canvas with a random mystical glyph instead of a number.
 * Used during the flight phase of predetermined rolls.
 */
function createScrambledAlbedoCanvas(theme: ThemeDefinition, fontScale = 1): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d')!;

  fillBackground(ctx, theme);
  drawCirclePad(ctx, theme);
  drawAccentCircle(ctx, theme);

  const glyph = pickRandomGlyph();
  const fontSize = Math.round(220 * fontScale);
  ctx.font = `700 ${fontSize}px ${SYMBOL_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.strokeStyle = theme.isGlass ? 'rgba(0,10,40,0.6)' : 'rgba(0,0,0,0.55)';
  ctx.lineWidth = 14;
  ctx.lineJoin = 'round';
  ctx.strokeText(glyph, SIZE / 2, SIZE / 2 + 10);

  ctx.fillStyle = theme.isGlass ? '#0d1f3c' : theme.numberColor;
  ctx.fillText(glyph, SIZE / 2, SIZE / 2 + 10);

  return canvas;
}

function createScrambledEmissiveCanvas(fontScale = 1): HTMLCanvasElement {
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

  const glyph = pickRandomGlyph();
  const fontSize = Math.round(220 * fontScale);
  ctx.font = `700 ${fontSize}px ${SYMBOL_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(glyph, SIZE / 2, SIZE / 2 + 10);

  return canvas;
}

function createScrambledD4AlbedoCanvas(theme: ThemeDefinition): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE; canvas.height = SIZE;
  const ctx = canvas.getContext('2d')!;

  fillBackground(ctx, theme);

  ctx.font = `700 140px ${SYMBOL_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (let i = 0; i < 3; i++) {
    const glyph = pickRandomGlyph();
    const [x, y] = D4_CORNER[i];
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(D4_ANGLE[i]);
    ctx.strokeStyle = theme.isGlass ? 'rgba(0,10,40,0.7)' : 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 14;
    ctx.lineJoin = 'round';
    ctx.strokeText(glyph, 0, 0);
    ctx.fillStyle = theme.isGlass ? '#0d1f3c' : theme.numberColor;
    ctx.fillText(glyph, 0, 0);
    ctx.restore();
  }
  return canvas;
}

function createScrambledD4EmissiveCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE; canvas.height = SIZE;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, SIZE, SIZE);

  ctx.font = `700 140px ${SYMBOL_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';

  for (let i = 0; i < 3; i++) {
    const glyph = pickRandomGlyph();
    const [x, y] = D4_CORNER[i];
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(D4_ANGLE[i]);
    ctx.fillText(glyph, 0, 0);
    ctx.restore();
  }
  return canvas;
}

/**
 * Returns scrambled material arrays for a die — every face shows a random
 * mystical glyph. Used during the flight phase of predetermined rolls.
 * NOT cached — each call produces fresh random glyphs.
 */
export function getScrambledFaceMaterials(
  definition: DieDefinition,
  theme: ThemeDefinition,
): THREE.MeshPhysicalMaterial[] | THREE.MeshStandardMaterial[] {
  if (definition.id === 'd4') {
    return definition.faceValues.map(() =>
      createFaceMaterial({
        theme,
        map:               tex(createScrambledD4AlbedoCanvas(theme)),
        emissiveMap:       tex(createScrambledD4EmissiveCanvas()),
        emissive:          emissiveFor(theme),
        emissiveIntensity: emissiveIntensityFor(theme),
      }),
    );
  }

  const fontScale = definition.id === 'd10-tens' ? 0.95 : 1;

  return definition.faceValues.map(() =>
    createFaceMaterial({
      theme,
      map:               tex(createScrambledAlbedoCanvas(theme, fontScale)),
      emissiveMap:       tex(createScrambledEmissiveCanvas(fontScale)),
      emissive:          emissiveFor(theme),
      emissiveIntensity: emissiveIntensityFor(theme),
    }),
  );
}

// ─── Blank face canvases (no number, just die colour) ───────────────────────

function createBlankAlbedoCanvas(theme: ThemeDefinition): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE; canvas.height = SIZE;
  const ctx = canvas.getContext('2d')!;
  fillBackground(ctx, theme);
  return canvas;
}

function createBlankEmissiveCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE; canvas.height = SIZE;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, SIZE, SIZE);
  return canvas;
}

// ─── D4 reveal: only apex corner shows the value ────────────────────────────

function createD4RevealAlbedoCanvas(
  faceIndex: number, apexVertex: number, value: number, theme: ThemeDefinition,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE; canvas.height = SIZE;
  const ctx = canvas.getContext('2d')!;
  fillBackground(ctx, theme);

  // Find which corner of this face corresponds to the apex vertex
  const verts = D4_FACE_VERTS[faceIndex];
  const apexCornerIdx = verts.indexOf(apexVertex);
  if (apexCornerIdx === -1) return canvas; // bottom face — entirely blank

  ctx.font = `900 160px ${SANS_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const [x, y] = D4_CORNER[apexCornerIdx];
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(D4_ANGLE[apexCornerIdx]);
  ctx.strokeStyle = theme.isGlass ? 'rgba(0,10,40,0.7)' : 'rgba(0,0,0,0.6)';
  ctx.lineWidth = 14;
  ctx.lineJoin = 'round';
  ctx.strokeText(String(value), 0, 0);
  ctx.fillStyle = theme.isGlass ? '#0d1f3c' : theme.numberColor;
  ctx.fillText(String(value), 0, 0);
  ctx.restore();
  return canvas;
}

function createD4RevealEmissiveCanvas(
  faceIndex: number, apexVertex: number, value: number,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE; canvas.height = SIZE;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, SIZE, SIZE);

  const verts = D4_FACE_VERTS[faceIndex];
  const apexCornerIdx = verts.indexOf(apexVertex);
  if (apexCornerIdx === -1) return canvas;

  ctx.font = `900 160px ${SANS_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  const [x, y] = D4_CORNER[apexCornerIdx];
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(D4_ANGLE[apexCornerIdx]);
  ctx.fillText(String(value), 0, 0);
  ctx.restore();
  return canvas;
}

/**
 * Returns reveal materials where only the result face shows the predetermined
 * value — all other faces show scrambled glyphs.
 *
 * For standard dice (d6, d8, d10, d12, d20): `upFaceIndex` determines which
 * face gets the number; all others show scrambled glyphs.
 *
 * For D4: `apexVertex` determines which vertex is the top point. On each face
 * containing that vertex, only the corner at the apex shows the value. The
 * bottom face (which doesn't contain the apex vertex) is entirely blank.
 *
 * NOT cached — each call creates fresh materials.
 */
export function getRevealFaceMaterials(
  definition: DieDefinition,
  theme: ThemeDefinition,
  value: number,
  upFaceIndex: number,
  apexVertex?: number,
): THREE.MeshPhysicalMaterial[] | THREE.MeshStandardMaterial[] {
  // ─── D4: apex-vertex-only corners ─────────────────────────────────────────
  if (definition.id === 'd4' && apexVertex !== undefined) {
    return definition.faceValues.map((_, fi) =>
      createFaceMaterial({
        theme,
        map:               tex(createD4RevealAlbedoCanvas(fi, apexVertex, value, theme)),
        emissiveMap:       tex(createD4RevealEmissiveCanvas(fi, apexVertex, value)),
        emissive:          emissiveFor(theme),
        emissiveIntensity: emissiveIntensityFor(theme),
      }),
    );
  }

  // ─── Standard dice: value on upFaceIndex, scrambled glyphs elsewhere ──────
  const fontScale = definition.id === 'd10-tens' ? 0.95 : 1;

  return definition.faceValues.map((_, i) => {
    const isResult = i === upFaceIndex;
    return createFaceMaterial({
      theme,
      map:               isResult
        ? getAlbedoTexture(value, theme, fontScale)
        : tex(createScrambledAlbedoCanvas(theme, fontScale)),
      emissiveMap:       isResult
        ? getEmissiveTexture(value, theme, fontScale)
        : tex(createScrambledEmissiveCanvas(fontScale)),
      emissive:          isResult ? emissiveFor(theme) : new THREE.Color(0x222222),
      emissiveIntensity: isResult ? emissiveIntensityFor(theme) : 0.5,
    });
  });
}

export function disposeFaceTextures(): void {
  _texCache.forEach(t => t.dispose());
  _texCache.clear();
  _emiCache.forEach(t => t.dispose());
  _emiCache.clear();
  _matCache.forEach(mats => mats.forEach(m => { m.map?.dispose(); (m as THREE.MeshStandardMaterial).emissiveMap?.dispose(); m.dispose(); }));
  _matCache.clear();
}
