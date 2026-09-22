import { describe, expect, it } from 'vitest';
import { COGNITIVE_EXERCISE_IDS, EXERCISE_IDS, EXERCISE_META, PASSIVE_EXERCISE_IDS } from '../src/domain/exercises';

describe('exercise registry', () => {
  it('contains unique exercise ids', () => {
    expect(new Set(EXERCISE_IDS).size).toBe(EXERCISE_IDS.length);
  });

  it('covers reaction and cognitive categories', () => {
    expect(PASSIVE_EXERCISE_IDS.length).toBeGreaterThan(0);
    expect(COGNITIVE_EXERCISE_IDS.length).toBeGreaterThan(0);
  });

  it('has complete metadata for each exercise', () => {
    for (const id of EXERCISE_IDS) {
      expect(EXERCISE_META[id].title.length).toBeGreaterThan(0);
      expect(EXERCISE_META[id].description.length).toBeGreaterThan(0);
      expect(['reaction', 'cognitive']).toContain(EXERCISE_META[id].category);
    }
  });
});
