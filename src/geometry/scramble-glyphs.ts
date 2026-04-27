/**
 * Pool of mystical Unicode glyphs used as scrambled face content
 * during predetermined roll animations.
 *
 * Mix of runic (ᚠ-ᛟ), alchemical (🜁-🜔), astrological (♈-♓),
 * and miscellaneous esoteric symbols for a thematic TTRPG feel.
 */

const GLYPH_POOL: readonly string[] = [
  // Elder Futhark runes
  'ᚠ', 'ᚢ', 'ᚦ', 'ᚨ', 'ᚱ', 'ᚲ', 'ᚷ', 'ᚹ', 'ᚺ', 'ᚾ',
  'ᛁ', 'ᛃ', 'ᛇ', 'ᛈ', 'ᛉ', 'ᛊ', 'ᛏ', 'ᛒ', 'ᛖ', 'ᛗ',
  'ᛚ', 'ᛜ', 'ᛞ', 'ᛟ',
  // Alchemical symbols
  '🜁', '🜂', '🜃', '🜄', '🜅',
  // Astrological / zodiac
  '♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓',
  // Misc esoteric
  '☽', '☾', '✧', '⍟', '⊛', '◈', '⬡', '⏣', '⌬',
];

/**
 * Returns a random glyph from the pool.
 * Uses crypto.getRandomValues for uniform distribution.
 */
export function pickRandomGlyph(): string {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return GLYPH_POOL[buf[0] % GLYPH_POOL.length];
}


