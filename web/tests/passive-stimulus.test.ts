import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIGS } from '../src/domain/config';
import { createNonRepeatingStimulus, createPassiveStimulus } from '../src/training/passive-stimulus';

function sequence(values: number[]): () => number {
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)] ?? 0;
}

describe('passive stimulus generation', () => {
  it('generates numbers inside the configured inclusive range', () => {
    const config = { ...DEFAULT_CONFIGS.numbers, minNumber: 3, maxNumber: 7 };
    expect(createPassiveStimulus(config, () => 0).label).toBe('3');
    expect(createPassiveStimulus(config, () => 0.9999).label).toBe('7');
  });

  it('avoids Stroop matches when matches are disabled', () => {
    const config = {
      ...DEFAULT_CONFIGS.stroop,
      colors: ['blue', 'red'] as const,
      allowMatches: false,
    };
    const stimulus = createPassiveStimulus(
      { ...config, colors: [...config.colors] },
      sequence([0, 0, 0.9]),
    );
    expect(stimulus.key).toBe('s-blue-red');
  });

  it('escapes custom words before placing them in HTML', () => {
    const config = { ...DEFAULT_CONFIGS.words, words: ['<GIRO>'] };
    const stimulus = createPassiveStimulus(config, () => 0);
    expect(stimulus.html).toContain('&lt;GIRO&gt;');
    expect(stimulus.html).not.toContain('<GIRO>');
  });

  it('retries a repeated stimulus when another option exists', () => {
    const config = { ...DEFAULT_CONFIGS.arrows, directions: ['up', 'down'] as const };
    const stimulus = createNonRepeatingStimulus(
      { ...config, directions: [...config.directions] },
      'up',
      sequence([0, 0.99]),
    );
    expect(stimulus.key).toBe('down');
  });

  it('rejects cognitive configs in the passive engine', () => {
    expect(() => createNonRepeatingStimulus(DEFAULT_CONFIGS['memory-match'], null))
      .toThrow(/propio motor interactivo/);
  });
});
