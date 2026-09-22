import {
  cognitiveResultDetailLabel,
  cognitiveResultDetailValue,
  cognitiveResultDetails,
  isCognitiveExercise,
} from '../cognitive-games';
import type { CognitiveConfig, ExerciseConfig } from '../domain/config';
import { COLOR_META, DIRECTION_META, EXERCISE_META } from '../domain/exercises';
import type { StoredSession } from '../domain/session';
import { formatDuration, formatMilliseconds, formatSeconds, formatWait } from '../utils/format';

export interface ResultsScreenActions {
  onBack: () => void;
  onRepeat: (session: StoredSession) => void;
}

function statCard(label: string, value: string, symbol: string): string {
  return `<div class="stat-card"><span>${symbol}</span><div><small>${label}</small><strong>${value}</strong></div></div>`;
}

function resultDetailLabel(config: ExerciseConfig): string {
  if (isCognitiveExercise(config.kind)) return cognitiveResultDetailLabel(config as CognitiveConfig);
  if (config.kind === 'arrows') return 'Direcciones';
  if (config.kind === 'numbers') return 'Rango';
  if (config.kind === 'colors') return 'Colores';
  if (config.kind === 'color-number') return 'Combinación';
  if (config.kind === 'stroop') return 'Consigna';
  return 'Palabras';
}

function resultDetailValue(config: ExerciseConfig): string {
  if (isCognitiveExercise(config.kind)) return cognitiveResultDetailValue(config as CognitiveConfig);
  if (config.kind === 'arrows') return String(config.directions.length);
  if (config.kind === 'numbers') return `${config.minNumber}–${config.maxNumber}`;
  if (config.kind === 'colors') return String(config.colors.length);
  if (config.kind === 'color-number') return `${config.colors.length} × ${config.maxNumber - config.minNumber + 1}`;
  if (config.kind === 'stroop') return config.instruction === 'ink' ? 'Color' : 'Palabra';
  if (config.kind === 'words') return String(config.words.length);
  return '—';
}

function resultStats(session: StoredSession): string {
  const summary = session.summary;
  if (summary.scored && summary.scored > 0) {
    const accuracy = Math.round((summary.accuracy ?? 0) * 100);
    return [
      statCard('Rondas', `${summary.completed} / ${summary.planned}`, EXERCISE_META[session.exercise].symbol),
      statCard('Aciertos', `${summary.correct ?? 0} / ${summary.scored}`, '✓'),
      statCard('Precisión', `${accuracy}%`, '◎'),
      statCard('Respuesta media', formatMilliseconds(summary.averageResponseMs ?? 0), '◷'),
    ].join('');
  }

  return [
    statCard('Estímulos', `${summary.completed} / ${summary.planned}`, EXERCISE_META[session.exercise].symbol),
    statCard('Duración', formatDuration(summary.durationMs), '◷'),
    statCard('Señal visible', formatSeconds(summary.stimulusDurationMs), 'ϟ'),
    statCard(resultDetailLabel(session.config), resultDetailValue(session.config), '✣'),
  ].join('');
}

function specificResultDetails(config: ExerciseConfig): string {
  if (isCognitiveExercise(config.kind)) return cognitiveResultDetails(config as CognitiveConfig);
  if (config.kind === 'arrows') {
    return `<div><dt>Direcciones activas</dt><dd>${config.directions.map((direction) => DIRECTION_META[direction].symbol).join(' ')}</dd></div>`;
  }
  if (config.kind === 'numbers') {
    return `<div><dt>Números posibles</dt><dd>${config.minNumber} a ${config.maxNumber}</dd></div>`;
  }
  if (config.kind === 'colors') {
    return `<div><dt>Colores activos</dt><dd>${config.colors.map((color) => COLOR_META[color].label).join(', ')}</dd></div>`;
  }
  if (config.kind === 'color-number') {
    return `<div><dt>Rango numérico</dt><dd>${config.minNumber} a ${config.maxNumber}</dd></div><div><dt>Colores activos</dt><dd>${config.colors.map((color) => COLOR_META[color].label).join(', ')}</dd></div>`;
  }
  if (config.kind === 'stroop') {
    return `<div><dt>Responder a</dt><dd>${config.instruction === 'ink' ? 'Color visible' : 'Palabra escrita'}</dd></div><div><dt>Coincidencias</dt><dd>${config.allowMatches ? 'Permitidas' : 'Evitadas'}</dd></div>`;
  }
  if (config.kind === 'words') {
    return `<div><dt>Consignas</dt><dd>${config.words.join(', ')}</dd></div>`;
  }
  return '';
}

export function mountResultsScreen(
  root: HTMLElement,
  session: StoredSession,
  actions: ResultsScreenActions,
): void {
  const meta = EXERCISE_META[session.exercise];

  root.innerHTML = `
    <main class="app-shell results-screen">
      <header class="topbar results-topbar">
        <button class="icon-button" data-action="back" aria-label="Volver al inicio">←</button>
        <div><h1>Sesión completada</h1><p>Entrenamiento de ${meta.title}</p></div>
        <div class="topbar-spacer"></div>
      </header>

      <section class="completion-card">
        <div class="trophy">★</div>
        <div><h2>Entrenamiento finalizado</h2><p>La secuencia de estímulos se completó correctamente.</p></div>
      </section>

      <section class="stats-grid">
        ${resultStats(session)}
      </section>

      <section class="session-detail-card">
        <h2>Configuración utilizada</h2>
        <dl class="session-detail-list">
          <div><dt>${isCognitiveExercise(session.exercise) ? 'Pausa entre rondas' : 'Espera entre señales'}</dt><dd>${formatWait(session.config.waitMinMs, session.config.waitMaxMs)}</dd></div>
          ${specificResultDetails(session.config)}
        </dl>
      </section>

      <div class="result-actions result-actions-three">
        <button class="primary-button" data-action="repeat">↻ &nbsp; Repetir</button>
        <button class="text-button" data-action="back">Volver al inicio</button>
      </div>
    </main>`;

  root.querySelectorAll<HTMLButtonElement>('[data-action="back"]').forEach((button) => {
    button.addEventListener('click', actions.onBack);
  });
  root.querySelector<HTMLButtonElement>('[data-action="repeat"]')?.addEventListener('click', () => actions.onRepeat(session));
}
