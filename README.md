# 🎲 react-ttrpg-dice

Plug-and-play React component for rolling polyhedral TTRPG dice with real-time 3D physics.

Dice are rendered with [Three.js](https://threejs.org/) via [React Three Fiber](https://docs.pmnd.rs/react-three-fiber) and simulated with the [Rapier](https://rapier.rs/) physics engine. Just pass standard dice notation and get back results — no WebGL boilerplate required.

## ✨ Features

- **Full polyhedral set** — d4, d6, d8, d10, d12, d20, and d100 (percentile)
- **Real physics** — Rapier rigid-body simulation with hull colliders, CCD, and progressive damping
- **5 built-in themes** — Obsidian, Ivory, Crimson, Glass (transmission), Metal
- **Multi-color dice groups** — roll dice of different themes in a single roll for attack vs. damage, advantage, etc.
- **Standard notation** — `"2d6"`, `"1d20 + 1d4"`, `"1d100"`, etc.
- **Full-page overlay** — renders on a fixed `z-index: 9999` layer; dice tumble over your UI then fade out
- **Accessible** — live-region announcements, `prefers-reduced-motion` support (instant roll, no animation)
- **Graceful degradation** — error boundary catches WebGL failures, falls back to instant math-only rolls
- **Tree-shakeable ESM** — `"sideEffects": false`, ships TypeScript declarations
- **React 18 & 19** compatible

## 📦 Installation

```bash
npm install react-ttrpg-dice
```

### Peer dependencies

These must already be in your project:

```bash
npm install react react-dom three @react-three/fiber @react-three/rapier
```

| Peer | Version |
| --- | --- |
| `react` | `^18.0` or `^19.0` |
| `react-dom` | `^18.0` or `^19.0` |
| `three` | `>=0.171.0` |
| `@react-three/fiber` | `>=9.0.0` |
| `@react-three/rapier` | `>=1.5.0` |

## 🚀 Quick Start

### Using the `useDiceRoll` hook (recommended)

```tsx
import { useDiceRoll } from 'react-ttrpg-dice';

function App() {
  const { roll, isRolling, result, DiceOverlayPortal } = useDiceRoll({
    config: { theme: 'obsidian' },
    onRollComplete: (r) => console.log('Total:', r.total),
  });

  return (
    <>
      <button onClick={() => roll('2d20 + 1d6')} disabled={isRolling}>
        {isRolling ? 'Rolling…' : '🎲 Roll!'}
      </button>

      {result && <p>Total: {result.total}</p>}

      {/* Renders the full-page 3D overlay */}
      {DiceOverlayPortal}
    </>
  );
}
```

### Using `<DiceOverlay>` directly

For more control, render the overlay component yourself:

```tsx
import { useState } from 'react';
import { DiceOverlay } from 'react-ttrpg-dice';
import type { RollResult } from 'react-ttrpg-dice';

function App() {
  const [rolling, setRolling] = useState(false);
  const [result, setResult] = useState<RollResult | null>(null);

  return (
    <>
      <button onClick={() => setRolling(true)}>Roll 1d20</button>

      {rolling && (
        <DiceOverlay
          roll="1d20"
          config={{ theme: 'crimson' }}
          onRollComplete={(r) => {
            setResult(r);
            setRolling(false);
          }}
        />
      )}
    </>
  );
}
```

## 🎯 Dice Notation

Standard TTRPG notation is supported. Multiple groups are joined with `+`:

| Notation | Spawns |
| --- | --- |
| `1d20` | One twenty-sided die |
| `2d6` | Two six-sided dice |
| `2d20 + 1d6` | Two d20s and one d6 |
| `4d6` | Four six-sided dice |
| `1d100` | A d10 (ones) + d10-tens (tens) |
| `d8` | Count defaults to 1 |

Supported die types: **d4**, **d6**, **d8**, **d10**, **d12**, **d20**, **d100**.
Maximum 20 dice per group. Case-insensitive (`2D6` = `2d6`).

## 🎨 Themes

Five built-in themes control the material, color, and rendering style of the dice:

| Theme | Description |
| --- | --- |
| `obsidian` | Deep purple body with gold numbers (default) |
| `ivory` | Warm cream body with dark brown numbers |
| `crimson` | Dark red body with gold numbers |
| `glass` | Transparent glass with transmission + refraction |
| `metal` | Silver-grey body with dark numbers |

### Custom colors

Override any theme's colors via the `config` prop:

```tsx
useDiceRoll({
  config: {
    theme: 'obsidian',
    dieColor: '#1a1a2e',      // body color
    numberColor: '#e94560',   // face number color
    accentColor: '#0f3460',   // accent highlights
    roughness: 0.4,
    metalness: 0.2,
  },
});
```

## 🎲 Dice Groups (Advanced)

Roll multiple groups of dice with different themes in a single roll — useful for distinguishing attack vs. damage, positive vs. negative effects, advantage rolls, etc.

### Using `rollGroups()`

```tsx
import { useDiceRoll } from 'react-ttrpg-dice';

function CombatRoller() {
  const { rollGroups, result, isRolling, DiceOverlayPortal } = useDiceRoll();

  const handleAttack = () => {
    rollGroups([
      { notation: '1d20', config: { theme: 'crimson' }, label: 'attack' },
      { notation: '2d6',  config: { theme: 'ivory' },   label: 'damage' },
    ]);
  };

  return (
    <>
      <button onClick={handleAttack} disabled={isRolling}>⚔️ Attack!</button>

      {result && (
        <div>
          <p>Attack: {result.rolls.filter(r => r.group === 'attack').map(r => r.value).join(', ')}</p>
          <p>Damage: {result.rolls.filter(r => r.group === 'damage').reduce((s, r) => s + r.value, 0)}</p>
        </div>
      )}

      {DiceOverlayPortal}
    </>
  );
}
```

### Per-group subtotals

Each `SingleDieResult` in the response includes a `group` field matching the label you provided. Filter and reduce to compute per-group totals:

```ts
const attackRoll = result.rolls.find(r => r.group === 'attack')?.value;
const damageTotal = result.rolls
  .filter(r => r.group === 'damage')
  .reduce((sum, r) => sum + r.value, 0);
```

Groups without a `config` inherit the top-level theme (or `obsidian` by default).
Groups without a `label` will have `group: undefined` in results.

## 📖 API Reference

### `useDiceRoll(options?)`

React hook that manages roll state and renders the 3D overlay.

#### Options

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `config` | `DiceThemeConfig` | `{}` | Theme and color overrides |
| `customRegistry` | `DieDefinition[]` | `[]` | Override or extend die definitions |
| `onRollComplete` | `(r: RollResult) => void` | — | Callback fired when dice settle |
| `timeout` | `number` | `6000` | Hard timeout (ms) before forcing |

#### Returns

| Property | Type | Description |
| --- | --- | --- |
| `roll(notation)` | `(string) => void` | Start a roll with the given notation |
| `rollGroups(groups)` | `(DiceGroup[]) => void` | Advanced: roll multiple groups with per-group themes |
| `isRolling` | `boolean` | `true` while physics is running |
| `result` | `RollResult` or `null` | Latest roll result, or `null` |
| `activeNotation` | `string` or `null` | The notation string of the current/last roll |
| `DiceOverlayPortal` | `ReactNode` | Render this in your JSX to display the 3D dice overlay |

### `<DiceOverlay>`

The underlying overlay component (used internally by `useDiceRoll`).

| Prop | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `roll` | `string` | ✅ | — | Dice notation string |
| `config` | `DiceThemeConfig` | — | `{}` | Theme and color overrides |
| `groups` | `DiceGroup[]` | — | — | Advanced: per-group themed dice |
| `customRegistry` | `DieDefinition[]` | — | `[]` | Override or extend die definitions |
| `onRollComplete` | `(r: RollResult) => void` | ✅ | — | Fires when all dice settle |
| `onRollStart` | `() => void` | — | — | Fires when roll animation begins |
| `timeout` | `number` | — | `6000` | Hard timeout (ms) |

### `RollResult`

```ts
interface RollResult {
  notation: string;         // Original notation, e.g. "2d6 + 1d4"
  total: number;            // Sum of all dice
  rolls: SingleDieResult[]; // Individual die results
}

interface SingleDieResult {
  type: DieType;   // "d4" | "d6" | "d8" | "d10" | "d12" | "d20" | "d100"
  value: number;   // Face value
  isMax: boolean;  // Rolled the highest possible value
  isMin: boolean;  // Rolled the lowest possible value
  group?: string;  // Group label (only present in grouped rolls)
}
```

### `DiceGroup`

Used with `rollGroups()` for advanced multi-themed rolls:

```ts
interface DiceGroup {
  notation: string;          // Dice notation for this group, e.g. "2d6"
  config?: DiceThemeConfig;  // Theme/color override for these dice
  label?: string;            // Label to tag results, e.g. "healing"
}
```

### `DiceThemeConfig`

```ts
interface DiceThemeConfig {
  theme?: 'obsidian' | 'ivory' | 'crimson' | 'glass' | 'metal';
  dieColor?: string;
  numberColor?: string;
  accentColor?: string;
  roughness?: number;
  metalness?: number;
}
```

### Advanced: `DieRegistry`

For custom dice definitions, import and configure the registry:

```tsx
import { DieRegistry } from 'react-ttrpg-dice';
import type { DieDefinition } from 'react-ttrpg-dice';

const customD6: DieDefinition = {
  id: 'd6',
  sides: 6,
  modelPath: '',
  physics: { mass: 1.0, friction: 0.6, restitution: 0.3, linearDamping: 0.3, angularDamping: 0.5 },
  readStrategy: 'face-up',
  faceNormals: [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]],
  faceValues: [3, 4, 6, 1, 2, 5],
};

// Pass as prop to override the built-in d6
<DiceOverlay roll="2d6" customRegistry={[customD6]} onRollComplete={handleResult} />
```

### Advanced: `parseDiceNotation` & `expandNotation`

Use the parser directly for headless/server-side notation validation:

```ts
import { parseDiceNotation, expandNotation, DiceNotationError } from 'react-ttrpg-dice';

try {
  const parsed = parseDiceNotation('2d20 + 1d6');
  // { groups: [{ count: 2, type: 'd20' }, { count: 1, type: 'd6' }], raw: '2d20 + 1d6' }

  const expanded = expandNotation(parsed);
  // [{ id: 'd20-1', registryId: 'd20', publicType: 'd20' }, ...]
} catch (e) {
  if (e instanceof DiceNotationError) {
    console.error(e.message, e.notation);
  }
}
```

## 🏗 Architecture

```
src/
├── index.ts                  # Public API barrel
├── types.ts                  # Shared TypeScript types
├── parser.ts                 # Dice notation parser
├── registry.ts               # Die definitions & registry
├── use-dice-roll.tsx          # useDiceRoll hook
├── components/
│   ├── dice-overlay.tsx       # Full-page Canvas overlay
│   ├── physics-scene.tsx      # Rapier physics world + settle detection
│   ├── die-mesh.tsx           # Per-die RigidBody + visual mesh
│   └── die-shadow.tsx         # Per-die blob shadow
├── geometry/
│   ├── face-groups.ts         # Procedural geometry with per-face UV groups
│   ├── face-textures.ts       # Canvas-rendered face number textures
│   └── procedural-*.ts        # Geometry generators per die type
├── physics/
│   ├── read-die.ts            # Read face value from physics body orientation
│   ├── spawn-grid.ts          # Spawn position calculation
│   └── throw-impulse.ts       # Random throw force generation
├── themes/
│   ├── theme-definitions.ts   # Built-in theme presets
│   ├── apply-theme.ts         # Config → ThemeDefinition resolver
│   └── create-die-material.ts # MeshStandardMaterial / MeshPhysicalMaterial factory
└── math/
    ├── build-roll-result.ts   # Assemble RollResult from physics readings
    ├── read-face-up.ts        # Dot-product face reading (face-up strategy)
    ├── read-vertex-up.ts      # Vertex reading (d4 fallback)
    ├── read-d100.ts           # Combine tens + ones for percentile
    ├── instant-roll.ts        # Math-only random roll (no physics)
    └── constants.ts           # Shared mathematical constants
```

### How a roll works

1. **Parse** — `parseDiceNotation` validates and tokenises the notation string
2. **Expand** — `expandNotation` creates individual physical die descriptors (d100 becomes two d10s)
3. **Spawn** — `PhysicsScene` places dice in a grid above the viewport and applies random impulses
4. **Simulate** — Rapier runs gravity, collisions, and damping; speed caps prevent tunnelling
5. **Settle** — dice are read via `onSleep` callback or velocity polling fallback
6. **Read** — the upward-facing face (or downward for d4) is determined by dot-product with face normals
7. **Cocked check** — if confidence is below threshold, the die is nudged and re-read (up to 3 tries)
8. **Result** — `buildRollResult` assembles the `RollResult` and fires `onRollComplete`
9. **Dismiss** — the overlay lingers 2.2 s, fades over 0.6 s, then unmounts

## 🧑‍💻 Development

```bash
# Install dependencies
npm install

# Watch mode (rebuilds on save via bunchee)
npm run dev

# Run tests
npm test

# Type-check
npm run typecheck

# Production build
npm run build
```

### Demo app

A standalone Vite demo lives in `demo/`:

```bash
cd demo
npm install
npm run dev
```

The demo links to the library via the workspace root — changes to `src/` are reflected live.

## 📄 License

[MIT](./LICENSE)

This library depends on [Rapier](https://rapier.rs/) (via `@react-three/rapier`), which is licensed under [Apache-2.0](https://www.apache.org/licenses/LICENSE-2.0). All other dependencies are MIT-licensed. See [THIRD_PARTY_NOTICES](./THIRD_PARTY_NOTICES) for full attribution details.
