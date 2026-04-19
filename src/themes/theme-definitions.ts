export interface ThemeDefinition {
  name: string;
  dieColor: string;
  numberColor: string;
  accentColor: string;
  roughness: number;
  metalness: number;
  isGlass: boolean;
  transmission?: number;
  ior?: number;
}

export type ThemeName = 'obsidian' | 'ivory' | 'crimson' | 'glass' | 'metal';

export const THEME_DEFINITIONS: Record<ThemeName, ThemeDefinition> = {
  obsidian: { name: 'obsidian', dieColor: '#2a1a4e', numberColor: '#c8a96e', accentColor: '#9b7fd4', roughness: 0.5, metalness: 0.1, isGlass: false },
  ivory:    { name: 'ivory',    dieColor: '#f0ebe0', numberColor: '#2c1810', accentColor: '#8b7355', roughness: 0.7, metalness: 0.0, isGlass: false },
  crimson:  { name: 'crimson',  dieColor: '#9b0000', numberColor: '#ffd700', accentColor: '#ff6a00', roughness: 0.5, metalness: 0.1, isGlass: false },
  glass:    { name: 'glass',    dieColor: '#ffffff', numberColor: '#ffffff', accentColor: '#e0f0ff',  roughness: 0.0, metalness: 0.0, isGlass: true, transmission: 1.0, ior: 1.5 },
  metal:    { name: 'metal',    dieColor: '#a0a0b0', numberColor: '#1a1a1a', accentColor: '#d4d4d4', roughness: 0.3, metalness: 0.5, isGlass: false },
};
