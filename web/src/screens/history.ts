import { EXERCISE_IDS, EXERCISE_META, type ExerciseId } from '../domain/exercises';

export interface HistorySessionView {
  exercise: ExerciseId;
  finishedAt: string;
  completed: number;
  scored?: number;
  accuracy?: number;
  durationMs: number;
}

export interface HistoryScreenActions {
  onBack: () => void;
  onTrain: () => void;
}

function formatDuration(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function renderContent(root: HTMLElement, sessions: HistorySessionView[], filter: ExerciseId | 'all', actions: HistoryScreenActions): void {
  const filters = root.querySelector<HTMLDivElement>('#history-filters');
  const list = root.querySelector<HTMLDivElement>('#history-list');
  if (!filters || !list) return;

  const usedExercises = EXERCISE_IDS.filter((id) => sessions.some((session) => session.exercise === id));
  filters.innerHTML = [
    `<button class="filter-chip ${filter === 'all' ? 'is-active' : ''}" data-filter="all">Todos</button>`,
    ...usedExercises.map((id) => `<button class="filter-chip ${filter === id ? 'is-active' : ''}" data-filter="${id}">${EXERCISE_META[id].title}</button>`),
  ].join('');

  filters.querySelectorAll<HTMLButtonElement>('[data-filter]').forEach((button) => {
    button.addEventListener('click', () => renderContent(root, sessions, button.dataset.filter as ExerciseId | 'all', actions));
  });

  const visible = filter === 'all' ? sessions : sessions.filter((session) => session.exercise === filter);
  if (!visible.length) {
    list.innerHTML = '<div class="empty-state"><div>◷</div><h2>Todavía no hay sesiones</h2><p>Completa un entrenamiento y aparecerá aquí.</p><button class="primary-button" data-action="train">Entrenar ahora</button></div>';
    list.querySelector<HTMLButtonElement>('[data-action="train"]')?.addEventListener('click', actions.onTrain);
    return;
  }

  list.innerHTML = visible.map((session) => {
    const meta = EXERCISE_META[session.exercise];
    const date = new Date(session.finishedAt);
    const score = session.scored
      ? `${Math.round((session.accuracy ?? 0) * 100)}% aciertos`
      : `${session.completed} estímulos`;

    return `<article class="history-card">
      <div class="history-symbol history-symbol-${session.exercise}">${meta.symbol}</div>
      <div class="history-copy"><strong>${meta.title}</strong><span>${date.toLocaleDateString('es-AR')} · ${date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</span></div>
      <div class="history-score"><strong>${score}</strong><span>${formatDuration(session.durationMs)}</span></div>
    </article>`;
  }).join('');
}

export function mountHistoryScreen(
  root: HTMLElement,
  sessions: HistorySessionView[] | null,
  actions: HistoryScreenActions,
): void {
  root.innerHTML = `
    <main class="app-shell history-screen">
      <header class="topbar">
        <button class="icon-button" data-action="back" aria-label="Volver">←</button>
        <div><h1>Historial</h1><p>Sesiones realizadas en este dispositivo</p></div>
        <div class="topbar-spacer"></div>
      </header>
      <div class="history-filters" id="history-filters"></div>
      <div class="history-list" id="history-list">${sessions ? '' : '<p class="loading">Cargando…</p>'}</div>
    </main>`;

  root.querySelector<HTMLButtonElement>('[data-action="back"]')?.addEventListener('click', actions.onBack);
  if (sessions) renderContent(root, sessions, 'all', actions);
}
