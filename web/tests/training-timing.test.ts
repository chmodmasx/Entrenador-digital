import { describe, expect, it } from 'vitest';
import { EXERCISE_IDS } from '../src/domain/exercises';
import { TIMING_POLICIES, sanitizeTimingSeconds } from '../src/training-timing';

describe('training timing policies', () => {
  it('defines positive playable defaults for every exercise', () => {
    for (const id of EXERCISE_IDS) {
      const policy = TIMING_POLICIES[id];
      expect(policy.defaultWaitMin).toBeGreaterThan(0);
      expect(policy.defaultWaitMax).toBeGreaterThan(0);
      expect(policy.defaultDuration).toBeGreaterThan(0);
      expect(policy.defaultWaitMin).toBeGreaterThanOrEqual(policy.pauseMin);
      expect(policy.defaultWaitMax).toBeLessThanOrEqual(policy.pauseMax);
      expect(policy.defaultDuration).toBeGreaterThanOrEqual(policy.durationMin);
      expect(policy.defaultDuration).toBeLessThanOrEqual(policy.durationMax);
    }
  });

  it('replaces zero timing values with safe defaults', () => {
    const result = sanitizeTimingSeconds('arrows', 0, 0, 0);
    expect(result.waitMin).toBe(TIMING_POLICIES.arrows.defaultWaitMin);
    expect(result.waitMax).toBe(TIMING_POLICIES.arrows.defaultWaitMax);
    expect(result.stimulusDuration).toBe(TIMING_POLICIES.arrows.defaultDuration);
  });

  it('keeps fixed-pause games fixed after sanitization', () => {
    const result = sanitizeTimingSeconds('memory-match', 0.4, 1.1, 3);
    expect(result.waitMin).toBe(result.waitMax);
    expect(result.waitMin).toBeGreaterThanOrEqual(TIMING_POLICIES['memory-match'].pauseMin);
    expect(result.waitMin).toBeLessThanOrEqual(TIMING_POLICIES['memory-match'].pauseMax);
  });

  it('falls back when a random pause range is effectively flat', () => {
    const result = sanitizeTimingSeconds('colors', 1, 1.05, 0.8);
    expect(result.waitMin).toBe(TIMING_POLICIES.colors.defaultWaitMin);
    expect(result.waitMax).toBe(TIMING_POLICIES.colors.defaultWaitMax);
  });
});
