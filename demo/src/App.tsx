import React, { useState } from 'react';
import { useDiceRoll } from 'react-ttrpg-dice';
import type { DiceThemeConfig } from 'react-ttrpg-dice';

const PRESETS = ['2d6', '1d20', '2d20 + 1d6', '4d6', '1d100', '1d8 + 1d4'];
const THEMES: DiceThemeConfig['theme'][] = ['obsidian', 'ivory', 'crimson', 'glass', 'metal'];

const styles: Record<string, React.CSSProperties> = {
  body: {
    margin: 0, fontFamily: "'Inter', sans-serif",
    background: 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)',
    minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#fff',
  },
  panel: {
    background: 'rgba(255,255,255,0.07)', backdropFilter: 'blur(16px)',
    border: '1px solid rgba(255,255,255,0.12)', borderRadius: 20,
    padding: '2.5rem', width: 480, maxWidth: '90vw',
    boxShadow: '0 32px 64px rgba(0,0,0,0.4)',
  },
  title: { margin: '0 0 0.25rem', fontSize: 28, fontWeight: 700, letterSpacing: -0.5 },
  sub:   { margin: '0 0 2rem', fontSize: 14, opacity: 0.5 },
  label: { display: 'block', fontSize: 12, fontWeight: 600, opacity: 0.6, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 },
  input: {
    width: '100%', boxSizing: 'border-box', padding: '0.75rem 1rem',
    background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: 10, color: '#fff', fontSize: 18, fontFamily: 'monospace',
    outline: 'none', marginBottom: '1rem',
  },
  presets: { display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: '1.5rem' },
  preset: {
    padding: '4px 12px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.2)',
    background: 'rgba(255,255,255,0.08)', color: '#fff', cursor: 'pointer',
    fontSize: 13, fontFamily: 'monospace',
  },
  themeRow: { display: 'flex', gap: 8, marginBottom: '1.5rem' },
  themeBtn: (active: boolean): React.CSSProperties => ({
    padding: '4px 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
    border: `1px solid ${active ? '#9b7fd4' : 'rgba(255,255,255,0.2)'}`,
    background: active ? 'rgba(155,127,212,0.3)' : 'rgba(255,255,255,0.06)',
    color: '#fff',
  }),
  btn: {
    width: '100%', padding: '0.9rem', borderRadius: 12, border: 'none',
    background: 'linear-gradient(135deg, #9b7fd4, #6c5ce7)',
    color: '#fff', fontSize: 18, fontWeight: 700, cursor: 'pointer',
    transition: 'opacity 0.2s', marginBottom: '1.5rem',
  },
  result: {
    background: 'rgba(155,127,212,0.12)', border: '1px solid rgba(155,127,212,0.3)',
    borderRadius: 12, padding: '1.25rem', textAlign: 'center',
  },
  total: { fontSize: 48, fontWeight: 700, margin: 0, color: '#c8a96e' },
  rolls: { margin: '0.5rem 0 0', opacity: 0.7, fontSize: 14 },
};

export default function App() {
  const [notation, setNotation] = useState('2d6');
  const [theme, setTheme] = useState<DiceThemeConfig['theme']>('obsidian');

  const { roll: doRoll, isRolling, result, DiceOverlayPortal } = useDiceRoll({
    config: { theme },
  });

  const handleRoll = () => doRoll(notation);

  return (
    <div style={styles.body}>
      <div style={styles.panel}>
        <h1 style={styles.title}>🎲 react-ttrpg-dice</h1>
        <p style={styles.sub}>WebGPU physics dice roller — demo</p>

        <label style={styles.label}>Notation</label>
        <input
          style={styles.input}
          value={notation}
          onChange={e => setNotation(e.target.value)}
          placeholder="e.g. 2d6 + 1d4"
          aria-label="Dice notation"
        />

        <label style={styles.label}>Presets</label>
        <div style={styles.presets}>
          {PRESETS.map(p => (
            <button key={p} style={styles.preset} onClick={() => setNotation(p)}>{p}</button>
          ))}
        </div>

        <label style={styles.label}>Theme</label>
        <div style={styles.themeRow}>
          {THEMES.map(t => (
            <button key={t} style={styles.themeBtn(theme === t)} onClick={() => setTheme(t)}>{t}</button>
          ))}
        </div>

        <button
          style={{ ...styles.btn, opacity: isRolling ? 0.5 : 1 }}
          disabled={isRolling}
          onClick={handleRoll}
          aria-label={`Roll ${notation}`}
        >
          {isRolling ? 'Rolling…' : '🎲 Roll!'}
        </button>

        {result && !isRolling && (
          <div style={styles.result} role="region" aria-label="Roll result">
            <p style={styles.total}>{result.total}</p>
            <p style={styles.rolls}>
              {result.rolls.map((r, i) => `${r.type}: ${r.value}`).join('  +  ')}
            </p>
            <p style={{ margin: '0.5rem 0 0', opacity: 0.5, fontSize: 12 }}>
              Notation: {result.notation}
            </p>
          </div>
        )}
      </div>

      {/* The 3D overlay mounts here, fixed-position over the whole page */}
      {DiceOverlayPortal}
    </div>
  );
}
