# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- **Fudge / Fate dice** — new `dF` notation (e.g. `4dF`, case-insensitive) rolls
  a six-sided die with two `+` (+1), two `−` (−1), and two blank (0) faces.
  Results report `type: 'dF'` with `value` in `{ -1, 0, 1 }`; `isMax` marks a
  `+1` and `isMin` a `−1`. Works with grouped, instant, and predetermined rolls.

---

## [0.3.1] — 2026-04-30

### Added

- **Configurable `zIndex`** — new optional `zIndex` prop on `<DiceOverlay>` and
  `useDiceRoll` options. Defaults to `9999` for backward compatibility. Useful
  when layering the dice overlay with other fixed-position overlays (e.g. a 3D
  card matt portal).

---

## [0.3.0] — 2026-04-27

### Added

- **Predetermined roll values** — pass known results to the dice roller so the
  physics animation plays normally but reveals the correct values on settle.
  Designed for multiplayer sync: the server rolls, clients receive the values
  and watch the dice tumble to the pre-decided outcome.

  - **Simple path** — `predeterminedValues` prop on `<DiceOverlay>` and the
    new `RollOptions` argument to `roll(notation, opts)`:
    ```tsx
    roll('2d20 + 1d6', { predeterminedValues: [17, 4, 3] });
    ```
  - **Advanced (grouped) path** — per-group `predeterminedValues` in
    `DiceGroup`, consumed by `rollGroups()`:
    ```tsx
    rollGroups([
      { notation: '1d20', label: 'attack', predeterminedValues: [17] },
      { notation: '2d6',  label: 'damage', predeterminedValues: [4, 6] },
    ]);
    ```
  - **Visual behaviour** — while in flight, dice show scrambled glyphs;
    on settle (or timeout), each die flashes and reveals its real face value.
  - **d100 decomposition** — a single consumer value (e.g. `73`) is split
    internally into the tens die (`70`) and ones die (`3`).
  - **`RollOptions`** is now exported from the public API.

### Removed

- **`SoundConfig.settleSound`** — the settle-thud option was removed during
  the audio engine cleanup.  The `settle` sound path is no longer
  independently controllable; use `volume` to adjust overall level.

### Internal

- **`create-die-material.ts` deleted** — material creation logic has been
  consolidated into `face-textures.ts`, eliminating a redundant factory.

---

## [0.2.0] — 2026-04-27

### Added

- **Procedural dice sounds** — opt-in collision and settle audio synthesised
  at runtime via the Web Audio API. No audio files, no external dependencies.
  Enable with `sound={true}` or pass a `SoundConfig` for fine-grained control
  (`volume`, `settleSound`). Hit loudness and pitch scale dynamically with
  collision speed and die height.
  ([`DiceSoundEngine`](src/sound/dice-sound.ts))

- **Camera angle control** — new `cameraAngle` prop (`{ x?, z? }`) offsets the
  orthographic camera from the default top-down position. Small values give a
  subtle tilt; larger values create a dramatic perspective.

- **Exported types** — `CameraAngle` and `SoundConfig` are now part of the
  public API.

### Changed

- **D10 geometry rewrite** — the pentagonal trapezohedron now enforces a
  geometric planarity constraint (`ringY/poleY = (1 − cos 36°)/(1 + cos 36°)`)
  so every kite face is perfectly flat, matching real injection-moulded d10s.
  Overall bounding radius adjusted to ≈ 0.60 for visual scale parity with d4,
  d8, and d12.

- **D10 UV projection** — new pole-oriented planar UV mapping
  (`computeD10PlanarUVs`) ensures every face's number top points toward the
  kite apex, eliminating flipped or rotated numerals on certain faces.

- **D10 face-normal constants** — `registry.ts` fallback normals updated to
  match the flatter geometry, ensuring reliable face-up reading for physics
  rolls.

- **D10-tens font scale** — percentile dice (d10-tens) now render numbers at
  95% font size for improved readability on the narrower kite faces.

### Fixed

- **`DiceOverlay` crash when using `groups` without `roll`** — the internal
  `parseDiceNotation` call is now guarded so it only runs on the simple-roll
  path. The `ReactTTRPGDiceProps` type is refactored into a discriminated union
  (`roll` vs `groups`) for compile-time safety.

---

## [0.1.1] — 2026-04-22

### Fixed

- Dice no longer fail to spin on page reload when the physics scene is
  re-mounted.

## [0.1.0] — 2026-04-22

### Added

- Multi-color dice groups — roll dice of different themes in a single
  roll via `rollGroups()` and the `groups` prop.

## [0.0.2] — 2026-04-22

### Changed

- Updated license files and third-party notices.

## [0.0.1] — 2026-04-22

### Added

- Initial release: full polyhedral set (d4, d6, d8, d10, d12, d20, d100),
  Rapier physics, five built-in themes, `useDiceRoll` hook, `DiceOverlay`
  component, dice notation parser, error boundary fallback, accessibility
  live-region announcements, `prefers-reduced-motion` support.

[0.3.1]: https://github.com/strangeworlder/react-ttrpg-dice/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/strangeworlder/react-ttrpg-dice/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/strangeworlder/react-ttrpg-dice/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/strangeworlder/react-ttrpg-dice/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/strangeworlder/react-ttrpg-dice/compare/v0.0.2...v0.1.0
[0.0.2]: https://github.com/strangeworlder/react-ttrpg-dice/compare/v0.0.1...v0.0.2
[0.0.1]: https://github.com/strangeworlder/react-ttrpg-dice/releases/tag/v0.0.1
