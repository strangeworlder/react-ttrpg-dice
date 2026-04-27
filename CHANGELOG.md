# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

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

[0.2.0]: https://github.com/strangeworlder/react-ttrpg-dice/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/strangeworlder/react-ttrpg-dice/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/strangeworlder/react-ttrpg-dice/compare/v0.0.2...v0.1.0
[0.0.2]: https://github.com/strangeworlder/react-ttrpg-dice/compare/v0.0.1...v0.0.2
[0.0.1]: https://github.com/strangeworlder/react-ttrpg-dice/releases/tag/v0.0.1
