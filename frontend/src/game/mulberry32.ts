/**
 * Generates a fresh non-zero 32-bit unsigned seed for each run so obstacles,
 * Power Gems, and energy cores never spawn in the same pattern twice.
 */
export function createRandomSeed(): number {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
      const buf = new Uint32Array(1);
      crypto.getRandomValues(buf);
      const val = buf[0] >>> 0;
      if (val !== 0) return val;
    }
  } catch {
    // Fallback below if Web Crypto is unavailable
  }
  const timeBits = Date.now() & 0xffffffff;
  const randBits = Math.floor(Math.random() * 0xffffffff);
  return ((timeBits ^ randBits ^ 0x9e3779b9) >>> 0) || 1;
}

/**
 * mulberry32 PRNG (32-bit pseudorandom number generator)
 * Deterministic random sequence given a numeric seed.
 * Ensures online opponents share the same freshly-randomized course per match,
 * while solo and rival runs generate a brand-new random seed every run.
 */
export function createMulberry32(seed: number) {
  // Avalanche initial seed bits (MurmurHash3 32-bit finalizer) so any two seeds diverge immediately
  let h = (Math.floor(seed) ^ 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  let s = (h ^ (h >>> 16)) >>> 0;

  return function next(): number {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
