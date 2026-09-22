import { cloneConfig, type ExerciseConfig } from './config';
import { sanitizeTimingSeconds } from '../training-timing';

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function finite(value: unknown): number | null {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

export function normalizeStoredExerciseConfig<T extends ExerciseConfig>(
  candidate: unknown,
  fallback: T,
): T {
  if (!isRecord(candidate) || candidate.kind !== fallback.kind) return cloneConfig(fallback);

  const merged = { ...cloneConfig(fallback), ...candidate } as T;
  const waitMinMs = finite(candidate.waitMinMs);
  const waitMaxMs = finite(candidate.waitMaxMs);
  const durationMs = finite(candidate.stimulusDurationMs);

  // Profiles before schema v2 stored these three values in seconds.
  const legacyWaitMin = finite(candidate.waitMin);
  const legacyWaitMax = finite(candidate.waitMax);
  const legacyDuration = finite(candidate.stimulusDuration);

  const timing = sanitizeTimingSeconds(
    merged.kind,
    waitMinMs !== null ? waitMinMs / 1000 : legacyWaitMin ?? Number.NaN,
    waitMaxMs !== null ? waitMaxMs / 1000 : legacyWaitMax ?? Number.NaN,
    durationMs !== null ? durationMs / 1000 : legacyDuration ?? Number.NaN,
  );

  merged.waitMinMs = Math.round(timing.waitMin * 1000);
  merged.waitMaxMs = Math.round(timing.waitMax * 1000);
  merged.stimulusDurationMs = Math.round(timing.stimulusDuration * 1000);

  const repetitions = finite(candidate.repetitions);
  merged.repetitions = repetitions !== null
    ? Math.min(200, Math.max(2, Math.round(repetitions)))
    : fallback.repetitions;

  return merged;
}
