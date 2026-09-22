import type { ExerciseConfig } from './config';
import type { ExerciseId } from './exercises';

export interface TrialResult {
  stimulus: string;
  shownAtMs: number;
  visibleForMs: number;
  correct?: boolean;
  responseMs?: number;
}

export interface SessionSummary {
  completed: number;
  planned: number;
  durationMs: number;
  stimulusDurationMs: number;
  scored?: number;
  correct?: number;
  accuracy?: number;
  averageResponseMs?: number;
}

export interface StoredSession {
  schemaVersion: number;
  id: string;
  exercise: ExerciseId;
  startedAt: string;
  finishedAt: string;
  config: ExerciseConfig;
  trials: TrialResult[];
  summary: SessionSummary;
}
