import type { ExerciseId } from './exercises';
import { timingPolicy } from '../training-timing';

export interface BaseTrainingValues {
  repetitions: number;
  waitMin: number;
  waitMax: number;
  stimulusDuration: number;
}

export type ValidationResult =
  | { ok: true; value: BaseTrainingValues }
  | { ok: false; error: string };

export function validateBaseTrainingValues(kind: ExerciseId, values: BaseTrainingValues): ValidationResult {
  const policy = timingPolicy(kind);
  const repetitions = Math.round(values.repetitions);

  if (!Number.isFinite(repetitions) || repetitions < 2 || repetitions > 200) {
    return { ok: false, error: 'La sesión debe tener entre 2 y 200 rondas o estímulos.' };
  }
  if (!Number.isFinite(values.stimulusDuration)
      || values.stimulusDuration < policy.durationMin
      || values.stimulusDuration > policy.durationMax) {
    return { ok: false, error: `El tiempo debe estar entre ${policy.durationMin} y ${policy.durationMax} s.` };
  }

  if (policy.pauseMode === 'fixed') {
    const pause = values.waitMin;
    if (!Number.isFinite(pause) || pause < policy.pauseMin || pause > policy.pauseMax) {
      return { ok: false, error: `La pausa debe estar entre ${policy.pauseMin} y ${policy.pauseMax} s.` };
    }
    return { ok: true, value: { repetitions, waitMin: pause, waitMax: pause, stimulusDuration: values.stimulusDuration } };
  }

  if (!Number.isFinite(values.waitMin) || !Number.isFinite(values.waitMax)
      || values.waitMin < policy.pauseMin || values.waitMax > policy.pauseMax
      || values.waitMax - values.waitMin < 0.1) {
    return {
      ok: false,
      error: `La aparición debe estar entre ${policy.pauseMin} y ${policy.pauseMax} s, con la máxima mayor que la mínima.`,
    };
  }

  return { ok: true, value: { ...values, repetitions } };
}
