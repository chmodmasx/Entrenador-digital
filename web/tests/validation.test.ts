import { describe, expect, it } from 'vitest';
import { validateBaseTrainingValues } from '../src/domain/validation';

describe('training config validation', () => {
  it('rejects zero repetitions', () => {
    const result = validateBaseTrainingValues('arrows', {
      repetitions: 0,
      waitMin: 0.8,
      waitMax: 2,
      stimulusDuration: 0.8,
    });
    expect(result.ok).toBe(false);
  });

  it('rejects zero stimulus duration', () => {
    const result = validateBaseTrainingValues('numbers', {
      repetitions: 20,
      waitMin: 0.8,
      waitMax: 2,
      stimulusDuration: 0,
    });
    expect(result.ok).toBe(false);
  });

  it('rejects reversed random ranges', () => {
    const result = validateBaseTrainingValues('stroop', {
      repetitions: 20,
      waitMin: 2,
      waitMax: 1,
      stimulusDuration: 1.2,
    });
    expect(result.ok).toBe(false);
  });

  it('normalizes fixed-pause games to one pause value', () => {
    const result = validateBaseTrainingValues('rule-shift', {
      repetitions: 20,
      waitMin: 0.6,
      waitMax: 1.8,
      stimulusDuration: 3,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.waitMax).toBe(result.value.waitMin);
  });
});
