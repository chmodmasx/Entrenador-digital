import { COLOR_META, DIRECTION_META, type DirectionId } from '../domain/exercises';
import type { ExerciseConfig, PassiveConfig } from '../domain/config';

export interface Stimulus {
  key: string;
  label: string;
  html: string;
}

export type RandomSource = () => number;

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  }[character] ?? character));
}

function randomItem<T>(items: readonly T[], random: RandomSource): T {
  return items[Math.floor(random() * items.length)] as T;
}

function randomInteger(min: number, max: number, random: RandomSource): number {
  return Math.floor(min + random() * (max - min + 1));
}

export function arrowSvg(direction: DirectionId, className = ''): string {
  const rotation = DIRECTION_META[direction].rotation;
  return `
    <svg class="${className}" viewBox="0 0 120 120" aria-hidden="true">
      <g transform="rotate(${rotation} 60 60)">
        <path d="M60 8 105 55H78v57H42V55H15L60 8Z" fill="currentColor" />
      </g>
    </svg>`;
}

export function createPassiveStimulus(
  config: PassiveConfig,
  random: RandomSource = Math.random,
): Stimulus {
  if (config.kind === 'arrows') {
    const direction = randomItem(config.directions, random);
    return {
      key: direction,
      label: DIRECTION_META[direction].label,
      html: arrowSvg(direction, 'stimulus-svg'),
    };
  }

  if (config.kind === 'numbers') {
    const value = randomInteger(config.minNumber, config.maxNumber, random);
    return {
      key: `n-${value}`,
      label: String(value),
      html: `<span class="stimulus-number-text">${value}</span>`,
    };
  }

  if (config.kind === 'colors') {
    const color = randomItem(config.colors, random);
    return {
      key: `c-${color}`,
      label: COLOR_META[color].label,
      html: `<span class="stimulus-color-disc" style="--stimulus-color:${COLOR_META[color].hex}" aria-label="${COLOR_META[color].label}"></span>`,
    };
  }

  if (config.kind === 'color-number') {
    const value = randomInteger(config.minNumber, config.maxNumber, random);
    const color = randomItem(config.colors, random);
    return {
      key: `cn-${color}-${value}`,
      label: `${COLOR_META[color].label} ${value}`,
      html: `<span class="stimulus-colored-number" style="--stimulus-color:${COLOR_META[color].hex}">${value}</span>`,
    };
  }

  if (config.kind === 'stroop') {
    const wordColor = randomItem(config.colors, random);
    let inkColor = randomItem(config.colors, random);
    if (!config.allowMatches && config.colors.length > 1) {
      let guard = 0;
      while (inkColor === wordColor && guard < 20) {
        inkColor = randomItem(config.colors, random);
        guard += 1;
      }
      if (inkColor === wordColor) {
        const index = config.colors.indexOf(wordColor);
        inkColor = config.colors[(index + 1) % config.colors.length]!;
      }
    }
    return {
      key: `s-${wordColor}-${inkColor}`,
      label: `${COLOR_META[wordColor].label} / ${COLOR_META[inkColor].label}`,
      html: `<span class="stimulus-stroop-word" style="--stimulus-color:${COLOR_META[inkColor].hex}">${escapeHtml(COLOR_META[wordColor].label.toLocaleUpperCase('es'))}</span>`,
    };
  }

  const word = randomItem(config.words, random);
  return {
    key: `w-${word}`,
    label: word,
    html: `<span class="stimulus-word-text">${escapeHtml(word)}</span>`,
  };
}

export function createNonRepeatingStimulus(
  config: ExerciseConfig,
  previousKey: string | null,
  random: RandomSource = Math.random,
): Stimulus {
  if (
    config.kind === 'flow' ||
    config.kind === 'memory-match' ||
    config.kind === 'memory-matrix' ||
    config.kind === 'spatial-match' ||
    config.kind === 'star-search' ||
    config.kind === 'rule-shift'
  ) {
    throw new Error(`El juego ${config.kind} usa su propio motor interactivo.`);
  }

  let stimulus = createPassiveStimulus(config, random);
  let attempts = 0;
  while (stimulus.key === previousKey && attempts < 6) {
    stimulus = createPassiveStimulus(config, random);
    attempts += 1;
  }
  return stimulus;
}
