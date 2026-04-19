import * as THREE from 'three';
import type { RegistryId } from '../types.js';
import { createD4Geometry }  from './procedural-d4.js';
import { createD6Geometry }  from './procedural-d6.js';
import { createD8Geometry }  from './procedural-d8.js';
import { createD10Geometry } from './procedural-d10.js';
import { createD12Geometry } from './procedural-d12.js';
import { createD20Geometry } from './procedural-d20.js';

// Cache procedural geometries — create once, reuse
const _cache = new Map<string, THREE.BufferGeometry>();

function getProceduralGeometry(id: RegistryId): THREE.BufferGeometry {
  if (_cache.has(id)) return _cache.get(id)!;
  let geo: THREE.BufferGeometry;
  switch (id) {
    case 'd4':       geo = createD4Geometry();  break;
    case 'd6':       geo = createD6Geometry();  break;
    case 'd8':       geo = createD8Geometry();  break;
    case 'd10':
    case 'd10-tens': geo = createD10Geometry(); break;
    case 'd12':      geo = createD12Geometry(); break;
    case 'd20':      geo = createD20Geometry(); break;
    default:         geo = createD6Geometry();  break; // safe fallback
  }
  _cache.set(id, geo);
  return geo;
}

/**
 * Returns a geometry for the given die registry ID.
 * Uses the cached procedural geometry (GLB loading is deferred to a future update).
 *
 * TODO: When GLB assets are sourced, check `modelPath` and load via GLTFLoader.
 */
export function getDieGeometry(id: RegistryId, _modelPath?: string): THREE.BufferGeometry {
  return getProceduralGeometry(id);
}

/** Dispose all cached geometries. Call when the library is unmounted. */
export function disposeCachedGeometries(): void {
  _cache.forEach(geo => geo.dispose());
  _cache.clear();
}
