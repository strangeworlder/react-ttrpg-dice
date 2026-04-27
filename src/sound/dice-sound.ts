import type { SoundConfig } from '../types.js';

// ─── Tuning constants ─────────────────────────────────────────────────────────

/** Minimum ms between two impact sounds (prevents audio overload) */
const THROTTLE_MS = 60;

/** Duration of the white-noise buffer in seconds */
const NOISE_DURATION = 0.06;

/**
 * Speed (m/s) below which we skip the sound entirely.
 * Kept low so the final gentle tip-over before settling is still audible.
 */
const MIN_SPEED = 0.3;

/**
 * Speed value that maps to full volume.  Anything above is clamped to 1.0.
 * The physics scene caps linear speed at 7 m/s, so 6 gives headroom.
 */
const MAX_SPEED = 6;

/** Filter frequency range for hit sounds (Hz) — low end = soft tap, high end = sharp crack */
const HIT_FREQ_LO = 800;
const HIT_FREQ_HI = 3000;

/** Settle thud: lower frequency, longer decay */
const SETTLE_FREQ = 800;
const SETTLE_DURATION = 0.12;

// ─── Engine ───────────────────────────────────────────────────────────────────

/**
 * Singleton-style procedural audio engine for dice collision sounds.
 *
 * All sounds are synthesised at runtime from a single pre-generated
 * white-noise AudioBuffer, shaped per-hit by a bandpass filter and an
 * exponential-decay gain envelope.
 *
 * Design goals:
 *  • **Zero audio files** — nothing to load, cache, or license.
 *  • **Zero dependencies** — only the native Web Audio API.
 *  • **Collision-reactive** — hit volume and pitch scale with Rapier's
 *    `totalForceMagnitude`, so soft taps sound different from hard cracks.
 *  • **Lazy initialisation** — the `AudioContext` is created on the first
 *    `playHit()` call, which is always inside a user-gesture handler
 *    (the roll button click), satisfying browser autoplay policies.
 */
export class DiceSoundEngine {
  private ctx: AudioContext | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private lastHitTime = 0;
  private volume: number;
  private settleEnabled: boolean;

  constructor(config: SoundConfig = {}) {
    this.volume = Math.max(0, Math.min(1, config.volume ?? 0.6));
    this.settleEnabled = config.settleSound ?? true;
  }

  // ── Lazy init ─────────────────────────────────────────────────────────────

  /**
   * Ensure the AudioContext exists and is running.
   * Safe to call repeatedly — subsequent calls are no-ops.
   */
  resume(): void {
    this.ensureContext();
  }

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.noiseBuffer = this.createNoiseBuffer(NOISE_DURATION);
    }
    // Resume if suspended (browser autoplay policy)
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  /**
   * Pre-generate a short buffer of white noise.
   * Reused by every hit — each playback gets its own BufferSourceNode
   * which the browser garbage-collects after it finishes.
   */
  private createNoiseBuffer(duration: number): AudioBuffer {
    const ctx = this.ctx!;
    const length = Math.ceil(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Play a collision "clack" whose loudness and brightness scale with
   * the die's speed and height at the moment of impact.
   *
   * @param speed  Linear velocity magnitude (m/s) at collision time.
   * @param height Y-position of the die (world units). Higher = louder.
   */
  playHit(speed: number, height: number = 0): void {
    if (speed < MIN_SPEED) return;

    // Throttle rapid-fire hits
    const now = performance.now();
    if (now - this.lastHitTime < THROTTLE_MS) return;
    this.lastHitTime = now;

    const ctx = this.ensureContext();
    const noise = this.noiseBuffer!;

    // Normalise speed to 0–1
    const t = Math.min((speed - MIN_SPEED) / (MAX_SPEED - MIN_SPEED), 1);

    // Height multiplier: spawn is ~9 units, floor is 0.
    // Range 0.15 (floor) – 1.0 (spawn height) so low bounces are quiet, not silent.
    const hFactor = 0.15 + 0.85 * Math.min(height / 9, 1);

    // ── Source ───────────────────────────────────────────────────────────
    const src = ctx.createBufferSource();
    src.buffer = noise;

    // ── Bandpass filter — brighter for harder hits ───────────────────────
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = HIT_FREQ_LO + t * (HIT_FREQ_HI - HIT_FREQ_LO);
    filter.Q.value = 1.0 + t * 2.0; // tighter resonance on hard hits

    // ── Gain envelope — fast attack, exponential decay ──────────────────
    const gain = ctx.createGain();
    const peak = this.volume * (0.15 + t * 0.85) * hFactor;
    const attackEnd = ctx.currentTime + 0.002;     // 2 ms attack
    const decayEnd = ctx.currentTime + 0.02 + (1 - t) * 0.04; // 20–60 ms decay

    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(peak, attackEnd);
    gain.gain.exponentialRampToValueAtTime(0.001, decayEnd);

    // ── Connect & play ──────────────────────────────────────────────────
    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start(ctx.currentTime);
    src.stop(ctx.currentTime + NOISE_DURATION);
  }

  /**
   * Play a low-pitched "thud" when a die comes to rest.
   * Only fires if `settleSound` is enabled in the config.
   */
  playSettle(): void {
    if (!this.settleEnabled) return;

    const ctx = this.ensureContext();

    // Use a longer noise buffer for the settle sound
    const length = Math.ceil(ctx.sampleRate * SETTLE_DURATION);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const src = ctx.createBufferSource();
    src.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = SETTLE_FREQ;
    filter.Q.value = 0.7;

    const gain = ctx.createGain();
    const peak = this.volume * 0.35;
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(peak, ctx.currentTime + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + SETTLE_DURATION);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start(ctx.currentTime);
    src.stop(ctx.currentTime + SETTLE_DURATION);
  }

  /** Release the AudioContext.  Safe to call if never initialised. */
  dispose(): void {
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
      this.noiseBuffer = null;
    }
  }
}
