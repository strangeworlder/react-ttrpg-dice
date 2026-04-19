import * as THREE from 'three';
import type { ThemeDefinition } from './theme-definitions.js';

/**
 * Creates a Three.js material from a resolved ThemeDefinition.
 * Glass themes use MeshPhysicalMaterial (transmission).
 * All others use MeshStandardMaterial.
 */
export function createDieMaterial(
  theme: ThemeDefinition,
): THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial {
  const shared = {
    // DoubleSide so custom procedural geometry with any face winding renders correctly
    side: THREE.DoubleSide,
  };

  if (theme.isGlass) {
    return new THREE.MeshPhysicalMaterial({
      ...shared,
      color: new THREE.Color(theme.dieColor),
      roughness: theme.roughness,
      metalness: theme.metalness,
      transmission: theme.transmission ?? 1.0,
      ior: theme.ior ?? 1.5,
      thickness: 0.5,
      transparent: true,
      opacity: 0.92,
    });
  }

  return new THREE.MeshStandardMaterial({
    ...shared,
    color: new THREE.Color(theme.dieColor),
    roughness: theme.roughness,
    metalness: theme.metalness,
  });
}
