import type { DiceThemeConfig } from '../types.js';
import { THEME_DEFINITIONS, type ThemeDefinition } from './theme-definitions.js';

/** Merges user config onto the chosen preset — user values always win. */
export function applyTheme(config: DiceThemeConfig = {}): ThemeDefinition {
  const preset = THEME_DEFINITIONS[config.theme ?? 'obsidian'];
  return {
    ...preset,
    dieColor:    config.dieColor    ?? preset.dieColor,
    numberColor: config.numberColor ?? preset.numberColor,
    accentColor: config.accentColor ?? preset.accentColor,
    roughness:   config.roughness   ?? preset.roughness,
    metalness:   config.metalness   ?? preset.metalness,
  };
}
