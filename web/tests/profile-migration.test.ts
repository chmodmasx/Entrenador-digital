import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIGS } from '../src/domain/config';
import { normalizeStoredExerciseConfig } from '../src/domain/profile-migration';

describe('profile config migration', () => {
  it('migrates legacy timing values from seconds to milliseconds', () => {
    const migrated = normalizeStoredExerciseConfig({
      kind: 'arrows',
      repetitions: 12,
      waitMin: 0.8,
      waitMax: 2,
      stimulusDuration: 0.9,
      directions: ['up', 'down'],
    }, DEFAULT_CONFIGS.arrows);

    expect(migrated.waitMinMs).toBe(800);
    expect(migrated.waitMaxMs).toBe(2000);
    expect(migrated.stimulusDurationMs).toBe(900);
    expect(migrated.repetitions).toBe(12);
    expect(migrated.directions).toEqual(['up', 'down']);
  });

  it('keeps current millisecond timing values', () => {
    const migrated = normalizeStoredExerciseConfig({
      ...DEFAULT_CONFIGS['memory-match'],
      waitMinMs: 700,
      waitMaxMs: 700,
      stimulusDurationMs: 3200,
    }, DEFAULT_CONFIGS['memory-match']);

    expect(migrated.waitMinMs).toBe(700);
    expect(migrated.waitMaxMs).toBe(700);
    expect(migrated.stimulusDurationMs).toBe(3200);
  });

  it('repairs zero timing values using playable defaults', () => {
    const migrated = normalizeStoredExerciseConfig({
      kind: 'star-search',
      repetitions: 12,
      waitMinMs: 0,
      waitMaxMs: 0,
      stimulusDurationMs: 0,
      pairCount: 4,
    }, DEFAULT_CONFIGS['star-search']);

    expect(migrated.waitMinMs).toBeGreaterThan(0);
    expect(migrated.waitMaxMs).toBeGreaterThan(0);
    expect(migrated.stimulusDurationMs).toBeGreaterThan(0);
  });

  it('falls back when the stored exercise kind does not match', () => {
    const migrated = normalizeStoredExerciseConfig({
      kind: 'numbers',
      repetitions: 999,
    }, DEFAULT_CONFIGS.arrows);

    expect(migrated).toEqual(DEFAULT_CONFIGS.arrows);
    expect(migrated).not.toBe(DEFAULT_CONFIGS.arrows);
  });
});
