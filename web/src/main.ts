import './styles.css';
import './passive.css';

type Direction =
  | 'up'
  | 'up-right'
  | 'right'
  | 'down-right'
  | 'down'
  | 'down-left'
  | 'left'
  | 'up-left';
type Screen = 'home' | 'config' | 'training' | 'results' | 'history';

interface AndroidBridge {
  setTrainingMode?: (enabled: boolean) => void;
  finishApp?: () => void;
}

declare global {
  interface Window {
    Android?: AndroidBridge;
    EntrenadorDigitalBack?: () => void;
  }
}

interface ArrowConfig {
  repetitions: number;
  waitMinMs: number;
  waitMaxMs: number;
  stimulusDurationMs: number;
  directions: Direction[];
}

interface TrialResult {
  stimulus: Direction;
  shownAtMs: number;
  visibleForMs: number;
}

interface SessionSummary {
  completed: number;
  planned: number;
  durationMs: number;
  stimulusDurationMs: number;
}

interface StoredSession {
  schemaVersion: 2;
  id: string;
  exercise: 'arrows';
  startedAt: string;
  finishedAt: string;
  config: ArrowConfig;
  trials: TrialResult[];
  summary: SessionSummary;
}

interface RuntimeSession {
  createdAt: number;
  activeStartedAt: number | null;
  startedAtIso: string;
  trials: TrialResult[];
  currentStimulus: Direction | null;
  phase: 'countdown' | 'waiting' | 'active' | 'done';
  phaseTimer?: number;
  clockTimer?: number;
}

const appElement = document.querySelector<HTMLDivElement>('#app');
if (!appElement) throw new Error('No se encontró #app');
const app: HTMLDivElement = appElement;

const directions: Record<Direction, { symbol: string; label: string; rotation: number }> = {
  up: { symbol: '↑', label: 'Arriba', rotation: 0 },
  'up-right': { symbol: '↗', label: 'Arriba derecha', rotation: 45 },
  right: { symbol: '→', label: 'Derecha', rotation: 90 },
  'down-right': { symbol: '↘', label: 'Abajo derecha', rotation: 135 },
  down: { symbol: '↓', label: 'Abajo', rotation: 180 },
  'down-left': { symbol: '↙', label: 'Abajo izquierda', rotation: 225 },
  left: { symbol: '←', label: 'Izquierda', rotation: 270 },
  'up-left': { symbol: '↖', label: 'Arriba izquierda', rotation: 315 },
};

const directionOrder = Object.keys(directions) as Direction[];

let screen: Screen = 'home';
let config: ArrowConfig = {
  repetitions: 20,
  waitMinMs: 700,
  waitMaxMs: 2200,
  stimulusDurationMs: 900,
  directions: [...directionOrder],
};
let runtime: RuntimeSession | null = null;
let lastSession: StoredSession | null = null;

function arrowSvg(direction: Direction, className = ''): string {
  const rotation = directions[direction].rotation;
  return `
    <svg class="${className}" viewBox="0 0 120 120" aria-hidden="true">
      <g transform="rotate(${rotation} 60 60)">
        <path d="M60 8 105 55H78v57H42V55H15L60 8Z" fill="currentColor" />
      </g>
    </svg>`;
}

function icon(name: string): string {
  const icons: Record<string, string> = {
    history: '<svg viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 2"/></svg>',
    settings: '<svg viewBox="0 0 24 24"><path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/></svg>',
    sliders: '<svg viewBox="0 0 24 24"><path d="M4 7h10M18 7h2M4 17h2M10 17h10M14 4v6M7 14v6"/></svg>',
  };
  return icons[name] ?? '';
}

function navigate(next: Screen): void {
  screen = next;
  window.scrollTo(0, 0);
  render();
}

function render(): void {
  document.body.classList.toggle('is-training', screen === 'training');
  if (screen === 'home') renderHome();
  if (screen === 'config') renderConfig();
  if (screen === 'training') renderTraining();
  if (screen === 'results') renderResults();
  if (screen === 'history') void renderHistory();
}

function renderHome(): void {
  app.innerHTML = `
    <main class="app-shell home-screen">
      <section class="brand-hero">
        <div class="brand-row">
          <div class="brand-mark" aria-hidden="true">ϟ</div>
          <div>
            <p class="eyebrow">ENTRENAMIENTO DE REACCIÓN</p>
            <h1>Entrenador Digital</h1>
          </div>
        </div>
        <div class="hero-copy">
          <p>Entrena tu atención.</p>
          <p>Mejora tu velocidad.</p>
          <p>Supera tus límites.</p>
        </div>
        <div class="speed-lines" aria-hidden="true"><span></span><span></span><span></span></div>
      </section>

      <section class="exercise-grid" aria-label="Ejercicios">
        ${exerciseCard('arrows', 'Flechas', 'Reacciona a la dirección', '<span class="exercise-arrow">➜</span>', false)}
        ${exerciseCard('numbers', 'Números', 'Reacciona a los números', '<span class="exercise-numbers">1·2·3</span>', true)}
        ${exerciseCard('colors', 'Colores', 'Reacciona al color', '<span class="color-dots"><i></i><i></i><i></i></span>', true)}
        ${exerciseCard('color-number', 'Color + número', 'Combina estímulos', '<span class="mixed-icon"><b>1</b><i></i><i></i></span>', true)}
        ${exerciseCard('stroop', 'Color y palabra', 'Evita la distracción', '<span class="letter-blocks"><b>A</b><b>B</b></span>', true)}
        ${exerciseCard('words', 'Palabras', 'Reacciona a las palabras', '<span class="word-icon">≡</span>', true)}
      </section>

      <nav class="home-shortcuts" aria-label="Accesos rápidos">
        <button class="shortcut-card" data-action="history">
          <span class="shortcut-icon">${icon('history')}</span>
          <span><strong>Historial</strong><small>Sesiones realizadas</small></span>
        </button>
        <button class="shortcut-card" data-action="presets" disabled>
          <span class="shortcut-icon">${icon('sliders')}</span>
          <span><strong>Presets</strong><small>Próximamente</small></span>
        </button>
        <button class="shortcut-card" data-action="settings" disabled>
          <span class="shortcut-icon">${icon('settings')}</span>
          <span><strong>Ajustes</strong><small>Próximamente</small></span>
        </button>
      </nav>

      <p class="home-motto"><span></span> DISCIPLINA HOY, REFLEJOS MAÑANA <span></span></p>
    </main>`;

  app.querySelector<HTMLButtonElement>('[data-exercise="arrows"]')?.addEventListener('click', () => navigate('config'));
  app.querySelector<HTMLButtonElement>('[data-action="history"]')?.addEventListener('click', () => navigate('history'));
}

function exerciseCard(id: string, title: string, subtitle: string, visual: string, disabled: boolean): string {
  return `
    <button class="exercise-card" data-exercise="${id}" ${disabled ? 'disabled aria-disabled="true"' : ''}>
      ${disabled ? '<span class="coming-soon">Próximamente</span>' : ''}
      <span class="exercise-visual">${visual}</span>
      <strong>${title}</strong>
      <small>${subtitle}</small>
    </button>`;
}

function renderConfig(): void {
  app.innerHTML = `
    <main class="app-shell config-screen">
      <header class="topbar">
        <button class="icon-button" data-action="back" aria-label="Volver">←</button>
        <div><h1>Flechas</h1><p>Configura tu entrenamiento</p></div>
        <div class="topbar-spacer"></div>
      </header>

      <form id="arrow-config" class="config-form">
        <section class="settings-card">
          <div class="section-title"><span>◷</span><div><h2>Sesión</h2><p>Define cuántas señales aparecerán</p></div></div>
          ${stepper('repetitions', 'Cantidad de estímulos', config.repetitions, 'señales', 2, 100, 1)}
        </section>

        <section class="settings-card">
          <div class="section-title"><span>◴</span><div><h2>Aparición</h2><p>Evita que el ritmo sea predecible</p></div></div>
          ${stepper('waitMin', 'Espera mínima', config.waitMinMs / 1000, 's', 0.3, 10, 0.1)}
          ${stepper('waitMax', 'Espera máxima', config.waitMaxMs / 1000, 's', 0.4, 15, 0.1)}
        </section>

        <section class="settings-card">
          <div class="section-title"><span>ϟ</span><div><h2>Estímulo</h2><p>Tiempo que cada flecha permanece visible</p></div></div>
          ${stepper('stimulusDuration', 'Duración visible', config.stimulusDurationMs / 1000, 's', 0.2, 5, 0.1)}
        </section>

        <section class="settings-card">
          <div class="section-title"><span>✣</span><div><h2>Direcciones</h2><p>Selecciona las direcciones que pueden aparecer</p></div></div>
          <div class="direction-options direction-options-eight">
            ${directionOrder.map((direction) => `
              <label class="check-option">
                <input type="checkbox" name="direction" value="${direction}" ${config.directions.includes(direction) ? 'checked' : ''} />
                <span class="fake-check">✓</span>
                <span class="direction-mini">${directions[direction].symbol}</span>
                ${directions[direction].label}
              </label>`).join('')}
          </div>
        </section>

        <div class="training-mode-note">
          <span>i</span>
          <div><strong>Entrenamiento físico</strong>La app muestra las señales automáticamente. Durante la sesión no necesitas tocar la pantalla: la respuesta se realiza en el entrenamiento real.</div>
        </div>

        <p class="form-error" id="form-error" role="alert"></p>
        <button class="primary-button start-button" type="submit"><span>▶</span> Iniciar entrenamiento</button>
      </form>
    </main>`;

  app.querySelector<HTMLButtonElement>('[data-action="back"]')?.addEventListener('click', () => navigate('home'));
  bindSteppers();
  app.querySelector<HTMLFormElement>('#arrow-config')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const selectedDirections = Array.from(form.querySelectorAll<HTMLInputElement>('input[name="direction"]:checked')).map((element) => element.value as Direction);
    const repetitions = numberInput('repetitions');
    const waitMin = numberInput('waitMin');
    const waitMax = numberInput('waitMax');
    const stimulusDuration = numberInput('stimulusDuration');
    const error = app.querySelector<HTMLParagraphElement>('#form-error');

    if (selectedDirections.length < 2) {
      if (error) error.textContent = 'Selecciona al menos dos direcciones.';
      return;
    }
    if (waitMax <= waitMin) {
      if (error) error.textContent = 'La espera máxima debe ser mayor que la mínima.';
      return;
    }

    config = {
      repetitions: Math.round(repetitions),
      waitMinMs: Math.round(waitMin * 1000),
      waitMaxMs: Math.round(waitMax * 1000),
      stimulusDurationMs: Math.round(stimulusDuration * 1000),
      directions: selectedDirections,
    };
    startTraining();
  });
}

function stepper(name: string, label: string, value: number, unit: string, min: number, max: number, step: number): string {
  const formatted = Number.isInteger(value) ? String(value) : value.toFixed(1).replace('.', ',');
  return `
    <div class="setting-row">
      <label for="${name}">${label}</label>
      <div class="stepper" data-stepper="${name}">
        <button type="button" data-delta="-${step}" aria-label="Disminuir ${label}">−</button>
        <div class="stepper-value"><input id="${name}" name="${name}" type="number" value="${value}" min="${min}" max="${max}" step="${step}" inputmode="decimal" /><span>${unit}</span><output aria-hidden="true">${formatted}</output></div>
        <button type="button" data-delta="${step}" aria-label="Aumentar ${label}">+</button>
      </div>
    </div>`;
}

function bindSteppers(): void {
  app.querySelectorAll<HTMLElement>('[data-stepper]').forEach((stepperElement) => {
    const input = stepperElement.querySelector<HTMLInputElement>('input');
    const output = stepperElement.querySelector<HTMLOutputElement>('output');
    if (!input || !output) return;

    const refresh = () => {
      const value = Number(input.value);
      output.value = Number.isInteger(value) ? String(value) : value.toFixed(1).replace('.', ',');
    };

    input.addEventListener('input', refresh);
    stepperElement.querySelectorAll<HTMLButtonElement>('button[data-delta]').forEach((button) => {
      button.addEventListener('click', () => {
        const delta = Number(button.dataset.delta ?? 0);
        const min = Number(input.min);
        const max = Number(input.max);
        const next = Math.min(max, Math.max(min, Number(input.value) + delta));
        input.value = String(Math.round(next * 10) / 10);
        refresh();
      });
    });
  });
}

function numberInput(id: string): number {
  return Number(app.querySelector<HTMLInputElement>(`#${id}`)?.value ?? 0);
}

function startTraining(): void {
  clearRuntimeTimers();
  runtime = {
    createdAt: performance.now(),
    activeStartedAt: null,
    startedAtIso: new Date().toISOString(),
    trials: [],
    currentStimulus: null,
    phase: 'countdown',
  };
  screen = 'training';
  render();
  beginCountdown();
}

function renderTraining(): void {
  app.innerHTML = `
    <main class="training-screen training-screen-passive">
      <header class="training-header">
        <button class="training-exit" data-action="back" aria-label="Detener y volver">←</button>
        <div class="training-heading"><strong>Flechas</strong><span>Sesión en curso</span></div>
        <button class="training-stop" data-action="stop">Detener</button>
      </header>

      <div class="training-progress" aria-hidden="true"><span id="progress-fill"></span></div>
      <div class="training-meta"><span>Estímulos completados</span><strong id="trial-counter">0 / ${config.repetitions}</strong></div>

      <section class="training-stage training-stage-passive">
        <div class="elapsed-block"><strong id="elapsed-time">0:00</strong><span>Tiempo transcurrido</span></div>
        <div class="stimulus-area stimulus-area-passive" id="stimulus-area">
          <div class="countdown" id="countdown">3</div>
          <div class="main-stimulus" id="main-stimulus" aria-live="off"></div>
        </div>
      </section>

      <p class="training-motto"><span></span> CONCENTRACIÓN EN CADA SEGUNDO <span></span></p>
    </main>`;

  app.querySelector<HTMLButtonElement>('[data-action="back"]')?.addEventListener('click', requestStopTraining);
  app.querySelector<HTMLButtonElement>('[data-action="stop"]')?.addEventListener('click', requestStopTraining);
  startElapsedClock();
}

function beginCountdown(): void {
  const countdown = app.querySelector<HTMLDivElement>('#countdown');
  if (!runtime || !countdown) return;

  const steps = ['3', '2', '1', '¡Ya!'];
  let index = 0;
  countdown.hidden = false;

  const advance = () => {
    if (!runtime || runtime.phase !== 'countdown') return;

    if (index < steps.length) {
      countdown.textContent = steps[index];
      index += 1;
      runtime.phaseTimer = window.setTimeout(advance, 700);
      return;
    }

    countdown.textContent = '';
    countdown.hidden = true;
    runtime.activeStartedAt = performance.now();
    scheduleNextStimulus();
  };

  advance();
}

function scheduleNextStimulus(): void {
  if (!runtime) return;
  if (runtime.trials.length >= config.repetitions) {
    void finishTraining();
    return;
  }

  clearPhaseTimer();
  runtime.phase = 'waiting';
  runtime.currentStimulus = null;
  setStimulusHtml('');

  const delay = randomBetween(config.waitMinMs, config.waitMaxMs);
  runtime.phaseTimer = window.setTimeout(showStimulus, delay);
}

function showStimulus(): void {
  if (!runtime || runtime.phase !== 'waiting') return;

  const direction = config.directions[Math.floor(Math.random() * config.directions.length)];
  if (!direction) return;

  runtime.currentStimulus = direction;
  runtime.phase = 'active';

  requestAnimationFrame(() => {
    if (!runtime || runtime.phase !== 'active' || runtime.currentStimulus !== direction) return;
    setStimulusHtml(arrowSvg(direction, 'stimulus-svg'));
    const activeStartedAt = runtime.activeStartedAt ?? performance.now();
    const shownAt = performance.now();

    runtime.phaseTimer = window.setTimeout(() => {
      if (!runtime || runtime.phase !== 'active' || runtime.currentStimulus !== direction) return;

      const actualVisibleForMs = performance.now() - shownAt;
      runtime.trials.push({
        stimulus: direction,
        shownAtMs: shownAt - activeStartedAt,
        visibleForMs: actualVisibleForMs,
      });
      runtime.currentStimulus = null;
      setStimulusHtml('');
      updateTrainingProgress();

      if (runtime.trials.length >= config.repetitions) {
        void finishTraining();
      } else {
        scheduleNextStimulus();
      }
    }, config.stimulusDurationMs);
  });
}

function updateTrainingProgress(): void {
  if (!runtime) return;
  const completed = runtime.trials.length;
  const counter = app.querySelector<HTMLElement>('#trial-counter');
  const fill = app.querySelector<HTMLElement>('#progress-fill');
  if (counter) counter.textContent = `${completed} / ${config.repetitions}`;
  if (fill) fill.style.width = `${Math.min(100, completed / config.repetitions * 100)}%`;
}

function startElapsedClock(): void {
  if (!runtime) return;

  const update = () => {
    if (!runtime) return;
    const elapsedMs = runtime.activeStartedAt === null ? 0 : performance.now() - runtime.activeStartedAt;
    const target = app.querySelector<HTMLElement>('#elapsed-time');
    if (target) target.textContent = formatDuration(elapsedMs);
  };

  update();
  runtime.clockTimer = window.setInterval(update, 250);
}

function requestStopTraining(): void {
  if (screen !== 'training') return;
  const shouldStop = window.confirm('¿Detener el entrenamiento?\n\nLa sesión actual no se guardará.');
  if (!shouldStop) return;
  stopTraining();
}

function stopTraining(): void {
  clearRuntimeTimers();
  runtime = null;
  navigate('config');
}

function setStimulusHtml(html: string): void {
  const stimulus = app.querySelector<HTMLDivElement>('#main-stimulus');
  if (stimulus) stimulus.innerHTML = html;
}

async function finishTraining(): Promise<void> {
  if (!runtime || runtime.phase === 'done') return;

  runtime.phase = 'done';
  clearRuntimeTimers();
  const activeStartedAt = runtime.activeStartedAt ?? runtime.createdAt;
  const durationMs = Math.max(0, performance.now() - activeStartedAt);

  lastSession = {
    schemaVersion: 2,
    id: createId(),
    exercise: 'arrows',
    startedAt: runtime.startedAtIso,
    finishedAt: new Date().toISOString(),
    config: { ...config, directions: [...config.directions] },
    trials: runtime.trials.map((trial) => ({ ...trial })),
    summary: {
      completed: runtime.trials.length,
      planned: config.repetitions,
      durationMs,
      stimulusDurationMs: config.stimulusDurationMs,
    },
  };

  await saveSession(lastSession);
  runtime = null;
  navigate('results');
}

function renderResults(): void {
  if (!lastSession) {
    navigate('home');
    return;
  }

  const session = lastSession;
  const summary = session.summary;
  app.innerHTML = `
    <main class="app-shell results-screen">
      <header class="topbar results-topbar">
        <button class="icon-button" data-action="home" aria-label="Volver al inicio">←</button>
        <div><h1>Sesión completada</h1><p>Entrenamiento de Flechas</p></div>
        <div class="topbar-spacer"></div>
      </header>

      <section class="completion-card">
        <div class="trophy">★</div>
        <div><h2>¡Entrenamiento finalizado!</h2><p>La secuencia de estímulos se completó correctamente.</p></div>
      </section>

      <section class="stats-grid">
        ${statCard('Estímulos', `${summary.completed} / ${summary.planned}`, '↑')}
        ${statCard('Duración', formatDuration(summary.durationMs), '◷')}
        ${statCard('Señal visible', formatSeconds(summary.stimulusDurationMs), 'ϟ')}
        ${statCard('Direcciones', String(session.config.directions.length), '✣')}
      </section>

      <section class="session-detail-card">
        <h2>Configuración utilizada</h2>
        <dl class="session-detail-list">
          <div><dt>Espera entre señales</dt><dd>${formatSeconds(session.config.waitMinMs)} – ${formatSeconds(session.config.waitMaxMs)}</dd></div>
          <div><dt>Direcciones activas</dt><dd>${session.config.directions.map((direction) => directions[direction].symbol).join(' ')}</dd></div>
        </dl>
      </section>

      <div class="result-actions">
        <button class="primary-button" data-action="repeat">↻ &nbsp; Repetir entrenamiento</button>
        <button class="secondary-button" data-action="home">Volver al inicio</button>
      </div>
    </main>`;

  app.querySelectorAll<HTMLButtonElement>('[data-action="home"]').forEach((button) => button.addEventListener('click', () => navigate('home')));
  app.querySelector<HTMLButtonElement>('[data-action="repeat"]')?.addEventListener('click', startTraining);
}

function statCard(label: string, value: string, symbol: string): string {
  return `<div class="stat-card"><span>${symbol}</span><div><small>${label}</small><strong>${value}</strong></div></div>`;
}

async function renderHistory(): Promise<void> {
  app.innerHTML = `
    <main class="app-shell history-screen">
      <header class="topbar">
        <button class="icon-button" data-action="back" aria-label="Volver">←</button>
        <div><h1>Historial</h1><p>Sesiones de entrenamiento guardadas</p></div>
        <div class="topbar-spacer"></div>
      </header>
      <div class="history-list" id="history-list"><p class="loading">Cargando…</p></div>
    </main>`;

  app.querySelector<HTMLButtonElement>('[data-action="back"]')?.addEventListener('click', () => navigate('home'));
  const sessions = await listSessions();
  if (screen !== 'history') return;

  const list = app.querySelector<HTMLDivElement>('#history-list');
  if (!list) return;

  if (!sessions.length) {
    list.innerHTML = '<div class="empty-state"><div>◷</div><h2>Todavía no hay sesiones</h2><p>Completa un entrenamiento de Flechas y aparecerá aquí.</p><button class="primary-button" data-action="train">Entrenar ahora</button></div>';
    list.querySelector<HTMLButtonElement>('[data-action="train"]')?.addEventListener('click', () => navigate('config'));
    return;
  }

  list.innerHTML = sessions.map((session) => {
    const date = new Date(session.finishedAt);
    return `<article class="history-card">
      <div class="history-symbol">↑</div>
      <div class="history-copy"><strong>Flechas</strong><span>${date.toLocaleDateString('es-AR')} · ${date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</span></div>
      <div class="history-score"><strong>${session.summary.completed} estímulos</strong><span>${formatDuration(session.summary.durationMs)}</span></div>
    </article>`;
  }).join('');
}

function formatDuration(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function formatSeconds(milliseconds: number): string {
  const seconds = milliseconds / 1000;
  const value = Number.isInteger(seconds) ? seconds.toFixed(0) : seconds.toFixed(1).replace('.', ',');
  return `${value} s`;
}

function randomBetween(min: number, max: number): number {
  return Math.floor(min + Math.random() * (max - min));
}

function createId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function clearPhaseTimer(): void {
  if (!runtime || runtime.phaseTimer === undefined) return;
  window.clearTimeout(runtime.phaseTimer);
  runtime.phaseTimer = undefined;
}

function clearRuntimeTimers(): void {
  if (!runtime) return;
  clearPhaseTimer();
  if (runtime.clockTimer !== undefined) window.clearInterval(runtime.clockTimer);
  runtime.clockTimer = undefined;
}

function handleAppBack(): void {
  if (screen === 'training') {
    requestStopTraining();
    return;
  }
  if (screen === 'config' || screen === 'results' || screen === 'history') {
    navigate('home');
    return;
  }
  if (window.Android && typeof window.Android.finishApp === 'function') {
    window.Android.finishApp();
  } else if (window.history.length > 1) {
    window.history.back();
  }
}

window.EntrenadorDigitalBack = handleAppBack;

const DB_NAME = 'entrenador-digital';
const DB_VERSION = 2;
const SESSION_STORE = 'sessions';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (db.objectStoreNames.contains(SESSION_STORE)) db.deleteObjectStore(SESSION_STORE);
      const store = db.createObjectStore(SESSION_STORE, { keyPath: 'id' });
      store.createIndex('finishedAt', 'finishedAt');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveSession(session: StoredSession): Promise<void> {
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(SESSION_STORE, 'readwrite');
      transaction.objectStore(SESSION_STORE).put(session);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    db.close();
  } catch (error) {
    console.error('No se pudo guardar la sesión', error);
  }
}

async function listSessions(): Promise<StoredSession[]> {
  try {
    const db = await openDatabase();
    const sessions = await new Promise<StoredSession[]>((resolve, reject) => {
      const result: StoredSession[] = [];
      const transaction = db.transaction(SESSION_STORE, 'readonly');
      const request = transaction.objectStore(SESSION_STORE).openCursor();
      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          result.push(cursor.value as StoredSession);
          cursor.continue();
        } else {
          resolve(result);
        }
      };
      request.onerror = () => reject(request.error);
    });
    db.close();
    return sessions.sort((a, b) => b.finishedAt.localeCompare(a.finishedAt));
  } catch (error) {
    console.error('No se pudo leer el historial', error);
    return [];
  }
}

render();
