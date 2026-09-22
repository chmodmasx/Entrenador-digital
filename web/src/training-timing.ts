export type TrainingExerciseKind =
  | 'arrows'
  | 'numbers'
  | 'colors'
  | 'color-number'
  | 'stroop'
  | 'words'
  | 'flow'
  | 'memory-match'
  | 'memory-matrix'
  | 'spatial-match'
  | 'star-search'
  | 'rule-shift';

export interface TimingPolicy {
  pauseMode: 'random' | 'fixed';
  defaultWaitMin: number;
  defaultWaitMax: number;
  pauseMin: number;
  pauseMax: number;
  defaultDuration: number;
  durationMin: number;
  durationMax: number;
}

export interface SanitizedTiming {
  waitMin: number;
  waitMax: number;
  stimulusDuration: number;
}

export const TIMING_POLICIES: Record<TrainingExerciseKind, TimingPolicy> = {
  arrows: {
    pauseMode: 'random',
    defaultWaitMin: 0.8,
    defaultWaitMax: 2.0,
    pauseMin: 0.3,
    pauseMax: 6.0,
    defaultDuration: 0.8,
    durationMin: 0.3,
    durationMax: 3.0,
  },
  numbers: {
    pauseMode: 'random',
    defaultWaitMin: 0.8,
    defaultWaitMax: 2.0,
    pauseMin: 0.3,
    pauseMax: 6.0,
    defaultDuration: 0.9,
    durationMin: 0.3,
    durationMax: 3.0,
  },
  colors: {
    pauseMode: 'random',
    defaultWaitMin: 0.8,
    defaultWaitMax: 2.0,
    pauseMin: 0.3,
    pauseMax: 6.0,
    defaultDuration: 0.8,
    durationMin: 0.3,
    durationMax: 3.0,
  },
  'color-number': {
    pauseMode: 'random',
    defaultWaitMin: 0.9,
    defaultWaitMax: 2.2,
    pauseMin: 0.3,
    pauseMax: 6.0,
    defaultDuration: 1.0,
    durationMin: 0.4,
    durationMax: 4.0,
  },
  stroop: {
    pauseMode: 'random',
    defaultWaitMin: 1.0,
    defaultWaitMax: 2.4,
    pauseMin: 0.4,
    pauseMax: 6.0,
    defaultDuration: 1.2,
    durationMin: 0.5,
    durationMax: 5.0,
  },
  words: {
    pauseMode: 'random',
    defaultWaitMin: 0.9,
    defaultWaitMax: 2.3,
    pauseMin: 0.4,
    pauseMax: 6.0,
    defaultDuration: 1.2,
    durationMin: 0.5,
    durationMax: 5.0,
  },
  flow: {
    pauseMode: 'random',
    defaultWaitMin: 0.5,
    defaultWaitMax: 1.0,
    pauseMin: 0.3,
    pauseMax: 3.0,
    defaultDuration: 2.5,
    durationMin: 1.2,
    durationMax: 5.0,
  },
  'memory-match': {
    pauseMode: 'fixed',
    defaultWaitMin: 0.6,
    defaultWaitMax: 0.6,
    pauseMin: 0.3,
    pauseMax: 2.0,
    defaultDuration: 3.0,
    durationMin: 1.0,
    durationMax: 6.0,
  },
  'memory-matrix': {
    pauseMode: 'fixed',
    defaultWaitMin: 0.8,
    defaultWaitMax: 0.8,
    pauseMin: 0.4,
    pauseMax: 2.5,
    defaultDuration: 1.5,
    durationMin: 0.6,
    durationMax: 4.0,
  },
  'spatial-match': {
    pauseMode: 'fixed',
    defaultWaitMin: 0.5,
    defaultWaitMax: 0.5,
    pauseMin: 0.3,
    pauseMax: 2.0,
    defaultDuration: 2.5,
    durationMin: 0.8,
    durationMax: 5.0,
  },
  'star-search': {
    pauseMode: 'fixed',
    defaultWaitMin: 0.7,
    defaultWaitMax: 0.7,
    pauseMin: 0.4,
    pauseMax: 2.5,
    defaultDuration: 6.0,
    durationMin: 2.0,
    durationMax: 12.0,
  },
  'rule-shift': {
    pauseMode: 'fixed',
    defaultWaitMin: 0.6,
    defaultWaitMax: 0.6,
    pauseMin: 0.3,
    pauseMax: 2.0,
    defaultDuration: 3.0,
    durationMin: 1.0,
    durationMax: 6.0,
  },
};

export function timingPolicy(kind: TrainingExerciseKind): TimingPolicy {
  return TIMING_POLICIES[kind];
}

function finitePositive(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function sanitizeTimingSeconds(
  kind: TrainingExerciseKind,
  waitMin: number,
  waitMax: number,
  stimulusDuration: number,
): SanitizedTiming {
  const policy = timingPolicy(kind);
  const duration = finitePositive(stimulusDuration)
    ? clamp(stimulusDuration, policy.durationMin, policy.durationMax)
    : policy.defaultDuration;

  if (policy.pauseMode === 'fixed') {
    const values = [waitMin, waitMax].filter(finitePositive);
    const candidate = values.length
      ? values.reduce((sum, value) => sum + value, 0) / values.length
      : policy.defaultWaitMin;
    const pause = clamp(candidate, policy.pauseMin, policy.pauseMax);
    return { waitMin: pause, waitMax: pause, stimulusDuration: duration };
  }

  if (!finitePositive(waitMin) || !finitePositive(waitMax)) {
    return {
      waitMin: policy.defaultWaitMin,
      waitMax: policy.defaultWaitMax,
      stimulusDuration: duration,
    };
  }

  let minimum = clamp(waitMin, policy.pauseMin, policy.pauseMax);
  let maximum = clamp(waitMax, policy.pauseMin, policy.pauseMax);
  if (maximum - minimum < 0.1) {
    minimum = policy.defaultWaitMin;
    maximum = policy.defaultWaitMax;
  }

  return { waitMin: minimum, waitMax: maximum, stimulusDuration: duration };
}
