import './styles.css';

type Direction = 'up' | 'right' | 'down' | 'left';
type Screen = 'home' | 'config' | 'training' | 'results' | 'history';
type TrialOutcome = 'correct' | 'incorrect' | 'omitted';

interface ArrowConfig {
  repetitions: number;
  waitMinMs: number;
  waitMaxMs: number;
  responseTimeoutMs: number;
  directions: Direction[];
}

interface TrialResult {
  stimulus: Direction;
  response?: Direction;
  reactionTimeMs?: number;
  outcome: TrialOutcome;
}

interface SessionSummary {
  averageMs: number | null;
  medianMs: number | null;
  bestMs: number | null;
  precision: number;
  correct: number;
  incorrect: number;
  omitted: number;
  anticipations: number;
}

interface StoredSession {
  id: string;
  exercise: 'arrows';
  startedAt: string;
  finishedAt: string;
  config: ArrowConfig;
  trials: TrialResult[];
  summary: SessionSummary;
}

interface RuntimeSession {
  startedAt: number;
  startedAtIso: string;
  trials: TrialResult[];
  anticipations: number;
  currentStimulus: Direction | null;
  shownAt: number | null;
  phase: 'countdown' | 'waiting' | 'active' | 'feedback' | 'done';
  waitTimer?: number;
  responseTimer?: number;
  clockTimer?: number;
}

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('No se encontró #app');

const directions: Record<Direction, { symbol: string; label: string; rotation: number }> = {
  up: { symbol: '↑', label: 'Arriba', rotation: 0 },
  right: { symbol: '→', label: 'Derecha', rotation: 90 },
  down: { symbol: '↓', label: 'Abajo', rotation: 180 },
  left: { symbol: '←', label: 'Izquierda', rotation: 270 },
};

let screen: Screen = 'home';
let config: ArrowConfig = {
  repetitions: 20,
  waitMinMs: 700,
  waitMaxMs: 2200,
  responseTimeoutMs: 1800,
  directions: ['up', 'right', 'down', 'left'],
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
          <span><strong>Historial</strong><small>Tu progreso</small></span>
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
          <div class="section-title"><span>◷</span><div><h2>Sesión</h2><p>Define la cantidad de intentos</p></div></div>
          ${stepper('repetitions', 'Repeticiones', config.repetitions, 'intentos', 4, 100, 1)}
        </section>

        <section class="settings-card">
          <div class="section-title"><span>◴</span><div><h2>Aparición</h2><p>Evita que el ritmo sea predecible</p></div></div>
          ${stepper('waitMin', 'Espera mínima', config.waitMinMs / 1000, 's', 0.3, 10, 0.1)}
          ${stepper('waitMax', 'Espera máxima', config.waitMaxMs / 1000, 's', 0.4, 15, 0.1)}
        </section>

        <section class="settings-card">
          <div class="section-title"><span>ϟ</span><div><h2>Respuesta</h2><p>Tiempo disponible para responder</p></div></div>
          ${stepper('timeout', 'Tiempo máximo', config.responseTimeoutMs / 1000, 's', 0.4, 5, 0.1)}
        </section>

        <section class="settings-card">
          <div class="section-title"><span>✣</span><div><h2>Direcciones</h2><p>Selecciona las direcciones a incluir</p></div></div>
          <div class="direction-options">
            ${(Object.keys(directions) as Direction[]).map((direction) => `
              <label class="check-option">
                <input type="checkbox" name="direction" value="${direction}" ${config.directions.includes(direction) ? 'checked' : ''} />
                <span class="fake-check">✓</span>
                <span class="direction-mini">${directions[direction].symbol}</span>
                ${directions[direction].label}
              </label>`).join('')}
          </div>
        </section>

        <section class="settings-card compact-card">
          <div class="section-title"><span>☝</span><div><h2>Modo de respuesta</h2><p>Usa los cuatro botones de la pantalla</p></div></div>
          <div class="selected-mode">▣ &nbsp; Botones en pantalla</div>
        </section>

        <p class="form-error" id="form-error" role="alert"></p>
        <button class="primary-button start-button" type="submit"><span>▶</span> Iniciar entrenamiento</button>
      </form>
    </main>`;

  app.querySelector<HTMLButtonElement>('[data-action="back"]')?.addEventListener('click', () => navigate('home'));
  bindSteppers();
  app.querySelector<HTMLFormElement>('#arrow-config')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const selectedDirections = Array.from(form.querySelectorAll<HTMLInputElement>('input[name="direction"]:checked')).map((el) => el.value as Direction);
    const repetitions = numberInput('repetitions');
    const waitMin = numberInput('waitMin');
    const waitMax = numberInput('waitMax');
    const timeout = numberInput('timeout');
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
      responseTimeoutMs: Math.round(timeout * 1000),
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
  app.querySelectorAll<HTMLElement>('[data-stepper]').forEach((stepperEl) => {
    const input = stepperEl.querySelector<HTMLInputElement>('input');
    const output = stepperEl.querySelector<HTMLOutputElement>('output');
    if (!input || !output) return;
    const refresh = () => {
      const value = Number(input.value);
      output.value = Number.isInteger(value) ? String(value) : value.toFixed(1).replace('.', ',');
    };
    input.addEventListener('input', refresh);
    stepperEl.querySelectorAll<HTMLButtonElement>('button[data-delta]').forEach((button) => {
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
    startedAt: performance.now(),
    startedAtIso: new Date().toISOString(),
    trials: [],
    anticipations: 0,
    currentStimulus: null,
    shownAt: null,
    phase: 'countdown',
  };
  screen = 'training';
  render();
  beginCountdown();
}

function renderTraining(): void {
  app.innerHTML = `
    <main class="training-screen">
      <header class="training-header">
        <button class="training-exit" data-action="exit" aria-label="Salir del entrenamiento">←</button>
        <div class="training-heading"><strong>Flechas</strong><span>Sesión en curso</span></div>
        <span class="trial-counter" id="trial-counter">0 / ${config.repetitions}</span>
      </header>
      <div class="training-progress" aria-hidden="true"><span id="progress-fill"></span></div>

      <section class="training-stage">
        <div class="elapsed-block"><strong id="elapsed-time">0:00</strong><span>Tiempo transcurrido</span></div>
        <div class="stimulus-area" id="stimulus-area">
          <div class="countdown" id="countdown">3</div>
          <div class="main-stimulus" id="main-stimulus" aria-live="off"></div>
          <div class="feedback-message" id="feedback-message" aria-live="polite"></div>
        </div>
      </section>

      <div class="response-strip" aria-label="Respuesta">
        ${(Object.keys(directions) as Direction[]).map((direction) => `
          <button class="response-button" data-response="${direction}" aria-label="${directions[direction].label}">
            <span>${directions[direction].symbol}</span><small>${directions[direction].label}</small>
          </button>`).join('')}
      </div>
      <p class="training-motto"><span></span> CONCENTRACIÓN EN CADA SEGUNDO <span></span></p>
    </main>`;

  app.querySelector<HTMLButtonElement>('[data-action="exit"]')?.addEventListener('click', () => {
    if (window.confirm('¿Quieres finalizar este entrenamiento?')) {
      clearRuntimeTimers();
      runtime = null;
      navigate('home');
    }
  });

  app.querySelectorAll<HTMLButtonElement>('[data-response]').forEach((button) => {
    const direction = button.dataset.response as Direction;
    const handler = () => handleResponse(direction, button);
    button.addEventListener('pointerdown', handler, { passive: true });
  });

  startElapsedClock();
}

function beginCountdown(): void {
  const countdown = app.querySelector<HTMLDivElement>('#countdown');
  if (!runtime || !countdown) return;
  let value = 3;
  countdown.textContent = String(value);
  const tick = window.setInterval(() => {
    value -= 1;
    if (value > 0) {
      countdown.textContent = String(value);
      return;
    }
    window.clearInterval(tick);
    countdown.textContent = '¡Ya!';
    window.setTimeout(() => {
      countdown.hidden = true;
      scheduleNextStimulus();
    }, 400);
  }, 700);
}

function scheduleNextStimulus(delayOverride?: number): void {
  if (!runtime) return;
  if (runtime.trials.length >= config.repetitions) {
    void finishTraining();
    return;
  }
  clearStimulusTimers();
  runtime.phase = 'waiting';
  runtime.currentStimulus = null;
  runtime.shownAt = null;
  setStimulusHtml('');
  setFeedback('', '');

  const delay = delayOverride ?? randomBetween(config.waitMinMs, config.waitMaxMs);
  runtime.waitTimer = window.setTimeout(showStimulus, delay);
}

function showStimulus(): void {
  if (!runtime || runtime.phase !== 'waiting') return;
  const direction = config.directions[Math.floor(Math.random() * config.directions.length)];
  runtime.currentStimulus = direction;
  runtime.phase = 'active';

  requestAnimationFrame(() => {
    if (!runtime || runtime.phase !== 'active') return;
    setStimulusHtml(arrowSvg(direction, 'stimulus-svg'));
    requestAnimationFrame(() => {
      if (!runtime || runtime.phase !== 'active') return;
      runtime.shownAt = performance.now();
      runtime.responseTimer = window.setTimeout(() => registerOmission(), config.responseTimeoutMs);
    });
  });
}

function handleResponse(direction: Direction, button: HTMLButtonElement): void {
  if (!runtime) return;
  pulseButton(button);

  if (runtime.phase === 'waiting') {
    runtime.anticipations += 1;
    clearStimulusTimers();
    runtime.phase = 'feedback';
    setFeedback('Anticipación', 'warning');
    window.setTimeout(() => scheduleNextStimulus(900), 350);
    return;
  }

  if (runtime.phase !== 'active' || !runtime.currentStimulus || runtime.shownAt === null) return;
  const reactionTimeMs = performance.now() - runtime.shownAt;
  const correct = direction === runtime.currentStimulus;
  runtime.trials.push({
    stimulus: runtime.currentStimulus,
    response: direction,
    reactionTimeMs,
    outcome: correct ? 'correct' : 'incorrect',
  });
  runtime.phase = 'feedback';
  clearStimulusTimers();
  updateTrainingProgress();
  setFeedback(correct ? `${Math.round(reactionTimeMs)} ms` : 'Incorrecta', correct ? 'success' : 'error');
  window.setTimeout(() => scheduleNextStimulus(), correct ? 220 : 420);
}

function registerOmission(): void {
  if (!runtime || runtime.phase !== 'active' || !runtime.currentStimulus) return;
  runtime.trials.push({ stimulus: runtime.currentStimulus, outcome: 'omitted' });
  runtime.phase = 'feedback';
  clearStimulusTimers();
  updateTrainingProgress();
  setFeedback('Sin respuesta', 'warning');
  window.setTimeout(() => scheduleNextStimulus(), 450);
}

function updateTrainingProgress(): void {
  if (!runtime) return;
  const done = runtime.trials.length;
  const counter = app.querySelector<HTMLElement>('#trial-counter');
  const fill = app.querySelector<HTMLElement>('#progress-fill');
  if (counter) counter.textContent = `${done} / ${config.repetitions}`;
  if (fill) fill.style.width = `${Math.min(100, done / config.repetitions * 100)}%`;
}

function startElapsedClock(): void {
  if (!runtime) return;
  const update = () => {
    if (!runtime) return;
    const elapsed = Math.floor((performance.now() - runtime.startedAt) / 1000);
    const min = Math.floor(elapsed / 60);
    const sec = elapsed % 60;
    const target = app.querySelector<HTMLElement>('#elapsed-time');
    if (target) target.textContent = `${min}:${String(sec).padStart(2, '0')}`;
  };
  update();
  runtime.clockTimer = window.setInterval(update, 250);
}

function setStimulusHtml(html: string): void {
  const stimulus = app.querySelector<HTMLDivElement>('#main-stimulus');
  if (stimulus) stimulus.innerHTML = html;
}

function setFeedback(text: string, state: '' | 'success' | 'error' | 'warning'): void {
  const feedback = app.querySelector<HTMLDivElement>('#feedback-message');
  if (!feedback) return;
  feedback.textContent = text;
  feedback.dataset.state = state;
}

function pulseButton(button: HTMLButtonElement): void {
  button.classList.remove('pressed');
  void button.offsetWidth;
  button.classList.add('pressed');
  window.setTimeout(() => button.classList.remove('pressed'), 120);
}

async function finishTraining(): Promise<void> {
  if (!runtime || runtime.phase === 'done') return;
  runtime.phase = 'done';
  clearRuntimeTimers();
  const summary = summarize(runtime.trials, runtime.anticipations);
  lastSession = {
    id: createId(),
    exercise: 'arrows',
    startedAt: runtime.startedAtIso,
    finishedAt: new Date().toISOString(),
    config: { ...config, directions: [...config.directions] },
    trials: runtime.trials.map((trial) => ({ ...trial })),
    summary,
  };
  await saveSession(lastSession);
  runtime = null;
  navigate('results');
}

function summarize(trials: TrialResult[], anticipations: number): SessionSummary {
  const correct = trials.filter((t) => t.outcome === 'correct');
  const incorrect = trials.filter((t) => t.outcome === 'incorrect').length;
  const omitted = trials.filter((t) => t.outcome === 'omitted').length;
  const times = correct.map((t) => t.reactionTimeMs).filter((value): value is number => typeof value === 'number').sort((a, b) => a - b);
  const averageMs = times.length ? times.reduce((sum, value) => sum + value, 0) / times.length : null;
  const medianMs = times.length ? (times.length % 2 ? times[(times.length - 1) / 2] : (times[times.length / 2 - 1] + times[times.length / 2]) / 2) : null;
  const precisionBase = correct.length + incorrect + omitted;
  return {
    averageMs,
    medianMs,
    bestMs: times.length ? times[0] : null,
    precision: precisionBase ? correct.length / precisionBase * 100 : 0,
    correct: correct.length,
    incorrect,
    omitted,
    anticipations,
  };
}

function renderResults(): void {
  if (!lastSession) {
    navigate('home');
    return;
  }
  const s = lastSession.summary;
  app.innerHTML = `
    <main class="app-shell results-screen">
      <header class="topbar results-topbar">
        <button class="icon-button" data-action="home" aria-label="Volver al inicio">←</button>
        <div><h1>Resultados</h1><p>Entrenamiento de Flechas</p></div>
        <div class="topbar-spacer"></div>
      </header>

      <section class="completion-card">
        <div class="trophy">★</div>
        <div><h2>¡Gran trabajo!</h2><p>Has completado ${lastSession.config.repetitions} intentos.</p></div>
      </section>

      <section class="stats-grid">
        ${statCard('Promedio', metric(s.averageMs), '▥')}
        ${statCard('Mediana', metric(s.medianMs), 'Σ')}
        ${statCard('Mejor', metric(s.bestMs), '◆')}
        ${statCard('Precisión', `${s.precision.toFixed(0)} %`, '◎')}
      </section>

      <section class="chart-card">
        <div class="chart-heading"><h2>Tiempos de reacción</h2><span>ms</span></div>
        ${reactionChart(lastSession.trials)}
      </section>

      <section class="outcome-grid">
        <div class="outcome success"><span>✓</span><small>Correctas</small><strong>${s.correct}</strong></div>
        <div class="outcome error"><span>×</span><small>Incorrectas</small><strong>${s.incorrect}</strong></div>
        <div class="outcome warning"><span>!</span><small>Anticipaciones</small><strong>${s.anticipations}</strong></div>
        <div class="outcome neutral"><span>–</span><small>Omitidas</small><strong>${s.omitted}</strong></div>
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

function metric(value: number | null): string {
  return value === null ? '—' : `${Math.round(value)} ms`;
}

function reactionChart(trials: TrialResult[]): string {
  const points = trials
    .map((trial, index) => ({ index, value: trial.reactionTimeMs }))
    .filter((point): point is { index: number; value: number } => typeof point.value === 'number');
  if (!points.length) return '<div class="empty-chart">No hay tiempos válidos para graficar.</div>';

  const width = 600;
  const height = 220;
  const padX = 30;
  const padY = 24;
  const max = Math.max(500, ...points.map((p) => p.value));
  const min = Math.max(0, Math.min(...points.map((p) => p.value)) - 80);
  const usableW = width - padX * 2;
  const usableH = height - padY * 2;
  const x = (index: number) => padX + (trials.length <= 1 ? 0 : index / (trials.length - 1) * usableW);
  const y = (value: number) => padY + (1 - (value - min) / Math.max(1, max - min)) * usableH;
  const polyline = points.map((p) => `${x(p.index).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  return `
    <svg class="reaction-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Gráfico de tiempos de reacción">
      <line x1="${padX}" y1="${padY}" x2="${padX}" y2="${height - padY}" class="chart-axis"/>
      <line x1="${padX}" y1="${height - padY}" x2="${width - padX}" y2="${height - padY}" class="chart-axis"/>
      <line x1="${padX}" y1="${padY + usableH / 2}" x2="${width - padX}" y2="${padY + usableH / 2}" class="chart-gridline"/>
      <polyline points="${polyline}" class="chart-line"/>
      ${points.map((p) => `<circle cx="${x(p.index)}" cy="${y(p.value)}" r="5" class="chart-dot"/>`).join('')}
    </svg>`;
}

async function renderHistory(): Promise<void> {
  app.innerHTML = `
    <main class="app-shell history-screen">
      <header class="topbar">
        <button class="icon-button" data-action="back" aria-label="Volver">←</button>
        <div><h1>Historial</h1><p>Tus entrenamientos guardados</p></div>
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
      <div class="history-score"><strong>${metric(session.summary.averageMs)}</strong><span>${session.summary.precision.toFixed(0)} % precisión</span></div>
    </article>`;
  }).join('');
}

function randomBetween(min: number, max: number): number {
  return Math.floor(min + Math.random() * (max - min));
}

function createId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function clearStimulusTimers(): void {
  if (!runtime) return;
  if (runtime.waitTimer !== undefined) window.clearTimeout(runtime.waitTimer);
  if (runtime.responseTimer !== undefined) window.clearTimeout(runtime.responseTimer);
  runtime.waitTimer = undefined;
  runtime.responseTimer = undefined;
}

function clearRuntimeTimers(): void {
  if (!runtime) return;
  clearStimulusTimers();
  if (runtime.clockTimer !== undefined) window.clearInterval(runtime.clockTimer);
  runtime.clockTimer = undefined;
}

const DB_NAME = 'entrenador-digital';
const DB_VERSION = 1;
const SESSION_STORE = 'sessions';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SESSION_STORE)) {
        const store = db.createObjectStore(SESSION_STORE, { keyPath: 'id' });
        store.createIndex('finishedAt', 'finishedAt');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveSession(session: StoredSession): Promise<void> {
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(SESSION_STORE, 'readwrite');
      tx.objectStore(SESSION_STORE).put(session);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
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
      const tx = db.transaction(SESSION_STORE, 'readonly');
      const request = tx.objectStore(SESSION_STORE).getAll();
      request.onsuccess = () => resolve(request.result as StoredSession[]);
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
