import {
  COLOR_IDS,
  DEFAULT_WORDS,
  DIRECTION_IDS,
  type ColorId,
  type DirectionId,
  type ExerciseId,
  type StroopInstruction,
} from './exercises';
import { timingPolicy } from '../training-timing';

export interface BaseConfig {
  repetitions: number;
  waitMinMs: number;
  waitMaxMs: number;
  stimulusDurationMs: number;
}

export interface ArrowsConfig extends BaseConfig {
  kind: 'arrows';
  directions: DirectionId[];
}

export interface NumbersConfig extends BaseConfig {
  kind: 'numbers';
  minNumber: number;
  maxNumber: number;
}

export interface ColorsConfig extends BaseConfig {
  kind: 'colors';
  colors: ColorId[];
}

export interface ColorNumberConfig extends BaseConfig {
  kind: 'color-number';
  minNumber: number;
  maxNumber: number;
  colors: ColorId[];
}

export interface StroopConfig extends BaseConfig {
  kind: 'stroop';
  colors: ColorId[];
  instruction: StroopInstruction;
  allowMatches: boolean;
}

export interface WordsConfig extends BaseConfig {
  kind: 'words';
  words: string[];
}

export interface FlowConfig extends BaseConfig {
  kind: 'flow';
}

export interface MemoryMatchConfig extends BaseConfig {
  kind: 'memory-match';
  nBack: number;
}

export interface MemoryMatrixConfig extends BaseConfig {
  kind: 'memory-matrix';
  gridSize: number;
  memoryCells: number;
}

export interface SpatialMatchConfig extends BaseConfig {
  kind: 'spatial-match';
  itemCount: number;
}

export interface StarSearchConfig extends BaseConfig {
  kind: 'star-search';
  pairCount: number;
}

export interface RuleShiftConfig extends BaseConfig {
  kind: 'rule-shift';
  optionCount: number;
}

export type PassiveConfig =
  | ArrowsConfig
  | NumbersConfig
  | ColorsConfig
  | ColorNumberConfig
  | StroopConfig
  | WordsConfig;

export type CognitiveConfig =
  | FlowConfig
  | MemoryMatchConfig
  | MemoryMatrixConfig
  | SpatialMatchConfig
  | StarSearchConfig
  | RuleShiftConfig;

export type ExerciseConfig = PassiveConfig | CognitiveConfig;

export interface ConfigMap {
  arrows: ArrowsConfig;
  numbers: NumbersConfig;
  colors: ColorsConfig;
  'color-number': ColorNumberConfig;
  stroop: StroopConfig;
  words: WordsConfig;
  flow: FlowConfig;
  'memory-match': MemoryMatchConfig;
  'memory-matrix': MemoryMatrixConfig;
  'spatial-match': SpatialMatchConfig;
  'star-search': StarSearchConfig;
  'rule-shift': RuleShiftConfig;
}

export function defaultTiming(kind: ExerciseId): Pick<BaseConfig, 'waitMinMs' | 'waitMaxMs' | 'stimulusDurationMs'> {
  const policy = timingPolicy(kind);
  return {
    waitMinMs: Math.round(policy.defaultWaitMin * 1000),
    waitMaxMs: Math.round(policy.defaultWaitMax * 1000),
    stimulusDurationMs: Math.round(policy.defaultDuration * 1000),
  };
}

export const DEFAULT_CONFIGS: ConfigMap = {
  arrows: {
    kind: 'arrows',
    repetitions: 20,
    ...defaultTiming('arrows'),
    directions: [...DIRECTION_IDS],
  },
  numbers: {
    kind: 'numbers',
    repetitions: 20,
    ...defaultTiming('numbers'),
    minNumber: 1,
    maxNumber: 9,
  },
  colors: {
    kind: 'colors',
    repetitions: 20,
    ...defaultTiming('colors'),
    colors: [...COLOR_IDS],
  },
  'color-number': {
    kind: 'color-number',
    repetitions: 20,
    ...defaultTiming('color-number'),
    minNumber: 1,
    maxNumber: 9,
    colors: [...COLOR_IDS],
  },
  stroop: {
    kind: 'stroop',
    repetitions: 20,
    ...defaultTiming('stroop'),
    colors: [...COLOR_IDS],
    instruction: 'ink',
    allowMatches: false,
  },
  words: {
    kind: 'words',
    repetitions: 20,
    ...defaultTiming('words'),
    words: [...DEFAULT_WORDS],
  },
  flow: {
    kind: 'flow',
    repetitions: 20,
    ...defaultTiming('flow'),
  },
  'memory-match': {
    kind: 'memory-match',
    repetitions: 24,
    ...defaultTiming('memory-match'),
    nBack: 2,
  },
  'memory-matrix': {
    kind: 'memory-matrix',
    repetitions: 12,
    ...defaultTiming('memory-matrix'),
    gridSize: 4,
    memoryCells: 5,
  },
  'spatial-match': {
    kind: 'spatial-match',
    repetitions: 20,
    ...defaultTiming('spatial-match'),
    itemCount: 4,
  },
  'star-search': {
    kind: 'star-search',
    repetitions: 12,
    ...defaultTiming('star-search'),
    pairCount: 4,
  },
  'rule-shift': {
    kind: 'rule-shift',
    repetitions: 20,
    ...defaultTiming('rule-shift'),
    optionCount: 3,
  },
};

export function cloneConfig<T extends ExerciseConfig>(config: T): T {
  return JSON.parse(JSON.stringify(config)) as T;
}

export function cloneConfigMap(source: ConfigMap = DEFAULT_CONFIGS): ConfigMap {
  return {
    arrows: cloneConfig(source.arrows),
    numbers: cloneConfig(source.numbers),
    colors: cloneConfig(source.colors),
    'color-number': cloneConfig(source['color-number']),
    stroop: cloneConfig(source.stroop),
    words: cloneConfig(source.words),
    flow: cloneConfig(source.flow),
    'memory-match': cloneConfig(source['memory-match']),
    'memory-matrix': cloneConfig(source['memory-matrix']),
    'spatial-match': cloneConfig(source['spatial-match']),
    'star-search': cloneConfig(source['star-search']),
    'rule-shift': cloneConfig(source['rule-shift']),
  };
}
