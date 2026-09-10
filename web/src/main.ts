import './styles.css';
import './passive.css';
import './sections.css';

type Direction =
  | 'up'
  | 'up-right'
  | 'right'
  | 'down-right'
  | 'down'
  | 'down-left'
  | 'left'
  | 'up-left';

type ExerciseId = 'arrows' | 'numbers' | 'colors' | 'color-number' | 'stroop' | 'words';
type ColorId = 'blue' | 'red' | 'green' | 'yellow' | 'orange' | 'violet';
type Screen = 'home' | 'config' | 'training' | 'results' | 'history' | 'presets' | 'settings';
type StroopInstruction = 'ink' | 'word';

interface AndroidBridge {
  setTrainingMode?: (enabled: boolean) => void;
  vibrate?: (milliseconds: number) => void;
  getAppVersion?: () => string;
  finishApp?: () => void;
}

declare global {
  interface Window {
    Android?: AndroidBridge;
  }
}

interface BaseConfig {
  repetitions: number;
  waitMinMs: number;
  waitMaxMs: number;
  stimulusDurationMs: number;
}

interface ArrowsConfig extends BaseConfig {
  kind: 'arrows';
  directions: Direction[];
}

interface NumbersConfig extends BaseConfig {
  kind: 'numbers';
  minNumber: number;
  maxNumber: number;
}

interface ColorsConfig extends BaseConfig {
  kind: 'colors';
  colors: ColorId[];
}

interface ColorNumberConfig extends BaseConfig {
  kind: 'color-number';
  minNumber: number;
  maxNumber: number;
  colors: ColorId[];
}

interface StroopConfig extends BaseConfig {
  kind: 'stroop';
  colors: ColorId[];
  instruction: StroopInstruction;
  allowMatches: boolean;
}

interface WordsConfig extends BaseConfig {
  kind: 'words';
  words: string[];
}

type ExerciseConfig = ArrowsConfig | NumbersConfig | ColorsConfig | ColorNumberConfig | StroopConfig | WordsConfig;

interface AppSettings {
  countdown: boolean;
  sound: boolean;
  vibration: boolean;
  showProgress: boolean;
}

interface Stimulus {
  key: string;
  label: string;
  html: string;
}

interface TrialResult {
  stimulus: string;
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
  schemaVersion: number;
  id: string;
  exercise: ExerciseId;
  startedAt: string;
  finishedAt: string;
  config: ExerciseConfig;
  trials: TrialResult[];
  summary: SessionSummary;
}

interface Preset {
  schemaVersion: 1;
  id: string;
  name: string;
  exercise: ExerciseId;
  config: ExerciseConfig;
  createdAt: string;
}

interface RuntimeSession {
  createdAt: number;
  activeStartedAt: number | null;
  startedAtIso: string;
  trials: TrialResult[];
  currentStimulus: Stimulus | null;
  lastStimulusKey: string | null;
  phase: 'countdown' | 'waiting' | 'active' | 'done';
  phaseTimer?: number;
  clockTimer?: number;
}

interface ExerciseMeta {
  title: string;
  subtitle: string;
  description: string;
  symbol: string;
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

const colors: Record<ColorId, { label: string; hex: string }> = {
  blue: { label: 'Azul', hex: '#019CE8' },
  red: { label: 'Rojo', hex: '#E44B4B' },
  green: { label: 'Verde', hex: '#22A86A' },
  yellow: { label: 'Amarillo', hex: '#F4C542' },
  orange: { label: 'Naranja', hex: '#F28A2E' },
  violet: { label: 'Violeta', hex: '#8A5CF6' },
};

const colorOrder = Object.keys(colors) as ColorId[];

const exerciseMeta: Record<ExerciseId, ExerciseMeta> = {
  arrows: {
    title: 'Flechas',
    subtitle: 'Reacciona a la dirección',
    description: 'Señales en ocho direcciones para desplazamientos y cambios de orientación.',
    symbol: '↑',
  },
  numbers: {
    title: 'Números',
    subtitle: 'Reacciona a los números',
    description: 'Números grandes y aleatorios para asociar consignas físicas o técnicas.',
    symbol: '123',
  },
  colors: {
    title: 'Colores',
    subtitle: 'Reacciona al color',
    description: 'Estímulos cromáticos de alta visibilidad para consignas rápidas.',
    symbol: '●',
  },
  'color-number': {
    title: 'Color + número',
    subtitle: 'Combina estímulos',
    description: 'Un número y un color aparecen juntos para aumentar la carga de decisión.',
    symbol: '7',
  },
  stroop: {
    title: 'Color y palabra',
    subtitle: 'Evita la distracción',
    description: 'Palabras de colores con tinta coincidente o distinta para trabajo tipo Stroop.',
    symbol: 'Aa',
  },
  words: {
    title: 'Palabras',
    subtitle: 'Reacciona a las palabras',
    description: 'Consignas personalizadas que aparecen automáticamente durante la sesión.',
    symbol: 'ABC',
  },
};

const defaultConfigs: Record<ExerciseId, ExerciseConfig> = {
  arrows: {
    kind: 'arrows',
    repetitions: 20,
    waitMinMs: 700,
    waitMaxMs: 2200,
    stimulusDurationMs: 900,
    directions: [...directionOrder],
  },
  numbers: {
    kind: 'numbers',
    repetitions: 20,
    waitMinMs: 700,
    waitMaxMs: 2200,
    stimulusDurationMs: 900,
    minNumber: 1,
    maxNumber: 9,
  },
  colors: {
    kind: 'colors',
    repetitions: 20,
    waitMinMs: 700,
    waitMaxMs: 2200,
    stimulusDurationMs: 900,
    colors: [...colorOrder],
  },
  'color-number': {
    kind: 'color-number',
    repetitions: 20,
    waitMinMs: 700,
    waitMaxMs: 2200,
    stimulusDurationMs: 900,
    minNumber: 1,
    maxNumber: 9,
    colors: [...colorOrder],
  },
  stroop: {
    kind: 'stroop',
    repetitions: 20,
    waitMinMs: 850,
    waitMaxMs: 2400,
    stimulusDurationMs: 1100,
    colors: [...colorOrder],
    instruction: 'ink',
    allowMatches: false,
  },
  words: {
    kind: 'words',
    repetitions: 20,
    waitMinMs: 800,
    waitMaxMs: 2300,
    stimulusDurationMs: 1100,
    words: ['ADELANTE', 'ATRÁS', 'IZQUIERDA', 'DERECHA', 'SALTO', 'GIRO'],
  },
};

const SETTINGS_KEY = 'entrenador-digital-settings-v1';
const defaultSettings: AppSettings = {
  countdown: true,
  sound: false,
  vibration: false,
  showProgress: true,
};

let settings = loadSettings();
let screen: Screen = 'home';
let selectedExercise: ExerciseId = 'arrows';
let configs: Record<ExerciseId, ExerciseConfig> = cloneConfigMap(defaultConfigs);
let runtime: RuntimeSession | null = null;
let lastSession: StoredSession | null = null;
let audioContext: AudioContext | null = null;

function cloneConfig<T extends ExerciseConfig>(config: T): T {
  return JSON.parse(JSON.stringify(config)) as T;
}

function cloneConfigMap(source: Record<ExerciseId, ExerciseConfig>): Record<ExerciseId, ExerciseConfig> {
  return {
    arrows: cloneConfig(source.arrows),
    numbers: cloneConfig(source.numbers),
    colors: cloneConfig(source.colors),
    'color-number': cloneConfig(source['color-number']),
    stroop: cloneConfig(source.stroop),
    words: cloneConfig(source.words),
  };
}

function loadSettings(): AppSettings {
  try {
    const parsed = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') as Partial<AppSettings>;
    return { ...defaultSettings, ...parsed };
  } catch {
    return { ...defaultSettings };
  }
}

function persistSettings(): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

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
  if (screen === 'presets') void renderPresets();
  if (screen === 'settings') renderSettings();
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
        ${exerciseCard('arrows', '<span class="exercise-arrow">➜</span>')}
        ${exerciseCard('numbers', '<span class="exercise-numbers">1·2·3</span>')}
        ${exerciseCard('colors', '<span class="color-dots"><i></i><i></i><i></i></span>')}
        ${exerciseCard('color-number', '<span class="mixed-icon"><b>7</b><i></i><i></i></span>')}
        ${exerciseCard('stroop', '<span class="letter-blocks"><b>A</b><b>B</b></span>')}
        ${exerciseCard('words', '<span class="word-icon">≡</span>')}
      </section>

      <nav class="home-shortcuts" aria-label="Accesos rápidos">
        <button class="shortcut-card" data-action="history">
          <span class="shortcut-icon">${icon('history')}</span>
          <span><strong>Historial</strong><small>Sesiones realizadas</small></span>
        </button>
        <button class="shortcut-card" data-action="presets">
          <span class="shortcut-icon">${icon('sliders')}</span>
          <span><strong>Presets</strong><small>Configuraciones guardadas</small></span>
        </button>
        <button class="shortcut-card" data-action="settings">
          <span class="shortcut-icon">${icon('settings')}</span>
          <span><strong>Ajustes</strong><small>Experiencia de entrenamiento</small></span>
        </button>
      </nav>

      <p class="home-motto"><span></span> DISCIPLINA HOY, REFLEJOS MAÑANA <span></span></p>
    </main>`;

  app.querySelectorAll<HTMLButtonElement>('[data-exercise]').forEach((button) => {
    button.addEventListener('click', () => {
      selectedExercise = button.dataset.exercise as ExerciseId;
      navigate('config');
    });
  });
  app.querySelector<HTMLButtonElement>('[data-action="history"]')?.addEventListener('click', () => navigate('history'));
  app.querySelector<HTMLButtonElement>('[data-action="presets"]')?.addEventListener('click', () => navigate('presets'));
  app.querySelector<HTMLButtonElement>('[data-action="settings"]')?.addEventListener('click', () => navigate('settings'));
}

function exerciseCard(id: ExerciseId, visual: string): string {
  const meta = exerciseMeta[id];
  return `
    <button class="exercise-card" data-exercise="${id}">
      <span class="exercise-visual">${visual}</span>
      <strong>${meta.title}</strong>
      <small>${meta.subtitle}</small>
    </button>`;
}

function renderConfig(): void {
  const meta = exerciseMeta[selectedExercise];
  const config = configs[selectedExercise];

  app.innerHTML = `
    <main class="app-shell config-screen">
      <header class="topbar">
        <button class="icon-button" data-action="back" aria-label="Volver">←</button>
        <div><h1>${meta.title}</h1><p>Configura tu entrenamiento</p></div>
        <div class="topbar-spacer"></div>
      </header>

      <section class="exercise-intro-card">
        <span class="exercise-intro-symbol">${meta.symbol}</span>
        <div><strong>${meta.title}</strong><p>${meta.description}</p></div>
      </section>

      <form id="exercise-config" class="config-form">
        ${sharedConfigSections(config)}
        ${specificConfigSection(config)}

        <div class="training-mode-note">
          <span>i</span>
          <div><strong>Entrenamiento físico</strong>La app muestra las señales automáticamente. La respuesta se realiza fuera de la pantalla, durante el ejercicio real.</div>
        </div>

        <p class="form-error" id="form-error" role="alert"></p>
        <div class="config-actions">
          <button class="secondary-button" type="button" data-action="save-preset">Guardar preset</button>
          <button class="primary-button start-button" type="submit"><span>▶</span> Iniciar entrenamiento</button>
        </div>
      </form>
    </main>`;

  app.querySelector<HTMLButtonElement>('[data-action="back"]')?.addEventListener('click', () => navigate('home'));
  bindSteppers();
  bindConfigEnhancements();

  const form = app.querySelector<HTMLFormElement>('#exercise-config');
  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    const next = readAndValidateConfig(form);
    if (!next) return;
    configs[selectedExercise] = next;
    prepareAudio();
    startTraining();
  });

  app.querySelector<HTMLButtonElement>('[data-action="save-preset"]')?.addEventListener('click', () => {
    if (!form) return;
    const next = readAndValidateConfig(form);
    if (!next) return;
    configs[selectedExercise] = next;
    openPresetNameModal(next);
  });
}

function sharedConfigSections(config: ExerciseConfig): string {
  return `
    <section class="settings-card">
      <div class="section-title"><span>◷</span><div><h2>Sesión</h2><p>Define cuántas señales aparecerán</p></div></div>
      ${stepper('repetitions', 'Cantidad de estímulos', config.repetitions, 'señales', 2, 200, 1)}
    </section>

    <section class="settings-card">
      <div class="section-title"><span>◴</span><div><h2>Aparición</h2><p>Evita que el ritmo sea predecible</p></div></div>
      ${stepper('waitMin', 'Espera mínima', config.waitMinMs / 1000, 's', 0.2, 15, 0.1)}
      ${stepper('waitMax', 'Espera máxima', config.waitMaxMs / 1000, 's', 0.3, 20, 0.1)}
    </section>

    <section class="settings-card">
      <div class="section-title"><span>ϟ</span><div><h2>Estímulo</h2><p>Controla cuánto tiempo permanece visible</p></div></div>
      ${stepper('stimulusDuration', 'Duración visible', config.stimulusDurationMs / 1000, 's', 0.2, 8, 0.1)}
    </section>`;
}

function specificConfigSection(config: ExerciseConfig): string {
  if (config.kind === 'arrows') {
    return `
      <section class="settings-card">
        <div class="section-title"><span>✣</span><div><h2>Direcciones</h2><p>Selecciona las direcciones que pueden aparecer</p></div></div>
        <div class="direction-options direction-options-eight">
          ${directionOrder.map((direction) => `
            <label class="check-option">
              <input type="checkbox" name="direction" value="${direction}" ${config.directions.includes(direction) ? 'checked' : ''} />
              <span class="fake-check">✓</span>
              <span class="direction-mini">${directions[direction].symbol}</span>
              <span>${directions[direction].label}</span>
            </label>`).join('')}
        </div>
      </section>`;
  }

  if (config.kind === 'numbers') {
    return `
      <section class="settings-card">
        <div class="section-title"><span>123</span><div><h2>Rango de números</h2><p>Define qué valores pueden aparecer</p></div></div>
        ${stepper('minNumber', 'Número mínimo', config.minNumber, '', 0, 99, 1)}
        ${stepper('maxNumber', 'Número máximo', config.maxNumber, '', 1, 999, 1)}
      </section>`;
  }

  if (config.kind === 'colors') {
    return colorSelectionSection(config.colors, 'Colores', 'Selecciona los colores que pueden aparecer');
  }

  if (config.kind === 'color-number') {
    return `
      <section class="settings-card">
        <div class="section-title"><span>123</span><div><h2>Rango de números</h2><p>Define qué valores pueden combinarse con un color</p></div></div>
        ${stepper('minNumber', 'Número mínimo', config.minNumber, '', 0, 99, 1)}
        ${stepper('maxNumber', 'Número máximo', config.maxNumber, '', 1, 999, 1)}
      </section>
      ${colorSelectionSection(config.colors, 'Colores', 'El número utilizará uno de estos colores')}`;
  }

  if (config.kind === 'stroop') {
    return `
      ${colorSelectionSection(config.colors, 'Colores y palabras', 'La palabra y el color visible se generan desde esta selección')}
      <section class="settings-card">
        <div class="section-title"><span>Aa</span><div><h2>Consigna</h2><p>Define qué información debe interpretar el deportista</p></div></div>
        <div class="segmented-control" role="group" aria-label="Consigna del ejercicio">
          <label><input type="radio" name="stroopInstruction" value="ink" ${config.instruction === 'ink' ? 'checked' : ''}><span>Color visible</span></label>
          <label><input type="radio" name="stroopInstruction" value="word" ${config.instruction === 'word' ? 'checked' : ''}><span>Palabra escrita</span></label>
        </div>
        ${toggleRow('allowMatches', 'Permitir coincidencias', 'A veces la palabra y su color serán iguales', config.allowMatches)}
      </section>`;
  }

  return `
    <section class="settings-card">
      <div class="section-title"><span>ABC</span><div><h2>Palabras</h2><p>Escribe una consigna por línea</p></div></div>
      <label class="textarea-field" for="wordList">
        <span>Lista de palabras</span>
        <textarea id="wordList" name="wordList" rows="7" maxlength="500">${escapeHtml(config.words.join('\n'))}</textarea>
        <small>Mínimo 2 palabras. Se mostrarán en mayúsculas para mejorar la lectura a distancia.</small>
      </label>
    </section>`;
}

function colorSelectionSection(selected: ColorId[], title: string, subtitle: string): string {
  return `
    <section class="settings-card">
      <div class="section-title"><span>●</span><div><h2>${title}</h2><p>${subtitle}</p></div></div>
      <div class="color-options">
        ${colorOrder.map((color) => `
          <label class="color-option">
            <input type="checkbox" name="color" value="${color}" ${selected.includes(color) ? 'checked' : ''} />
            <span class="color-swatch" style="--swatch:${colors[color].hex}"></span>
            <span>${colors[color].label}</span>
            <span class="color-check">✓</span>
          </label>`).join('')}
      </div>
    </section>`;
}

function toggleRow(id: string, title: string, description: string, checked: boolean): string {
  return `
    <label class="toggle-row" for="${id}">
      <span><strong>${title}</strong><small>${description}</small></span>
      <span class="toggle-control"><input id="${id}" type="checkbox" ${checked ? 'checked' : ''}><i></i></span>
    </label>`;
}

function stepper(name: string, label: string, value: number, unit: string, min: number, max: number, step: number): string {
  return `
    <div class="setting-row">
      <label for="${name}">${label}</label>
      <div class="stepper" data-stepper="${name}">
        <button type="button" data-delta="-${step}" aria-label="Disminuir ${label}">−</button>
        <div class="stepper-value">
          <input id="${name}" name="${name}" type="number" value="${value}" min="${min}" max="${max}" step="${step}" inputmode="decimal" />
          ${unit ? `<span>${unit}</span>` : ''}
        </div>
        <button type="button" data-delta="${step}" aria-label="Aumentar ${label}">+</button>
      </div>
    </div>`;
}

function bindSteppers(): void {
  const supportsPointer = 'PointerEvent' in window;

  app.querySelectorAll<HTMLElement>('[data-stepper]').forEach((stepperElement) => {
    const input = stepperElement.querySelector<HTMLInputElement>('input[type="number"]');
    if (!input) return;

    const applyDelta = (delta: number) => {
      const current = Number(input.value || 0);
      const min = input.min === '' ? -Infinity : Number(input.min);
      const max = input.max === '' ? Infinity : Number(input.max);
      const next = Math.min(max, Math.max(min, current + delta));
      const decimals = Math.abs(delta) < 1 ? 1 : 0;
      input.value = decimals ? next.toFixed(decimals) : String(Math.round(next));
      input.dispatchEvent(new Event('input', { bubbles: true }));
    };

    stepperElement.querySelectorAll<HTMLButtonElement>('button[data-delta]').forEach((button) => {
      let holdDelay: number | undefined;
      let repeatTimer: number | undefined;
      let startedAt = 0;
      let pointerHandled = false;

      const delta = Number(button.dataset.delta ?? 0);

      const clearTimers = () => {
        if (holdDelay !== undefined) window.clearTimeout(holdDelay);
        if (repeatTimer !== undefined) window.clearTimeout(repeatTimer);
        holdDelay = undefined;
        repeatTimer = undefined;
      };

      const repeat = () => {
        applyDelta(delta);
        const elapsed = Date.now() - startedAt;
        const delay = elapsed > 1500 ? 60 : elapsed > 800 ? 90 : 125;
        repeatTimer = window.setTimeout(repeat, delay);
      };

      const start = (event: Event) => {
        event.preventDefault();
        clearTimers();
        pointerHandled = true;
        startedAt = Date.now();
        applyDelta(delta);
        holdDelay = window.setTimeout(repeat, 360);
      };

      const stop = () => clearTimers();

      button.addEventListener('click', (event) => {
        if (pointerHandled) {
          pointerHandled = false;
          event.preventDefault();
          return;
        }
        applyDelta(delta);
      });

      if (supportsPointer) {
        button.addEventListener('pointerdown', start);
        button.addEventListener('pointerup', stop);
        button.addEventListener('pointercancel', stop);
        button.addEventListener('pointerleave', stop);
      } else {
        button.addEventListener('touchstart', start, { passive: false });
        button.addEventListener('touchend', stop);
        button.addEventListener('touchcancel', stop);
        button.addEventListener('mousedown', start);
        button.addEventListener('mouseup', stop);
        button.addEventListener('mouseleave', stop);
      }
    });
  });
}

function bindConfigEnhancements(): void {
  app.querySelectorAll<HTMLInputElement>('.check-option input, .color-option input').forEach((input) => {
    input.addEventListener('change', () => {
      const label = input.closest('label');
      label?.classList.toggle('is-selected', input.checked);
    });
    input.closest('label')?.classList.toggle('is-selected', input.checked);
  });
}

function numberInput(id: string): number {
  return Number(app.querySelector<HTMLInputElement>(`#${id}`)?.value ?? 0);
}

function readBaseConfig(): BaseConfig | null {
  const repetitions = numberInput('repetitions');
  const waitMin = numberInput('waitMin');
  const waitMax = numberInput('waitMax');
  const stimulusDuration = numberInput('stimulusDuration');

  if (!Number.isFinite(repetitions) || repetitions < 2) return showConfigError('La cantidad de estímulos debe ser de al menos 2.');
  if (!Number.isFinite(waitMin) || !Number.isFinite(waitMax) || waitMax <= waitMin) return showConfigError('La espera máxima debe ser mayor que la mínima.');
  if (!Number.isFinite(stimulusDuration) || stimulusDuration <= 0) return showConfigError('La duración visible debe ser mayor que cero.');

  return {
    repetitions: Math.round(repetitions),
    waitMinMs: Math.round(waitMin * 1000),
    waitMaxMs: Math.round(waitMax * 1000),
    stimulusDurationMs: Math.round(stimulusDuration * 1000),
  };
}

function readAndValidateConfig(form: HTMLFormElement): ExerciseConfig | null {
  const error = app.querySelector<HTMLParagraphElement>('#form-error');
  if (error) error.textContent = '';
  const base = readBaseConfig();
  if (!base) return null;

  if (selectedExercise === 'arrows') {
    const selected = Array.from(form.querySelectorAll<HTMLInputElement>('input[name="direction"]:checked')).map((element) => element.value as Direction);
    if (selected.length < 2) return showConfigError('Selecciona al menos dos direcciones.');
    return { kind: 'arrows', ...base, directions: selected };
  }

  if (selectedExercise === 'numbers') {
    const minNumber = Math.round(numberInput('minNumber'));
    const maxNumber = Math.round(numberInput('maxNumber'));
    if (maxNumber <= minNumber) return showConfigError('El número máximo debe ser mayor que el mínimo.');
    return { kind: 'numbers', ...base, minNumber, maxNumber };
  }

  if (selectedExercise === 'colors') {
    const selected = selectedColors(form);
    if (selected.length < 2) return showConfigError('Selecciona al menos dos colores.');
    return { kind: 'colors', ...base, colors: selected };
  }

  if (selectedExercise === 'color-number') {
    const minNumber = Math.round(numberInput('minNumber'));
    const maxNumber = Math.round(numberInput('maxNumber'));
    const selected = selectedColors(form);
    if (maxNumber <= minNumber) return showConfigError('El número máximo debe ser mayor que el mínimo.');
    if (selected.length < 2) return showConfigError('Selecciona al menos dos colores.');
    return { kind: 'color-number', ...base, minNumber, maxNumber, colors: selected };
  }

  if (selectedExercise === 'stroop') {
    const selected = selectedColors(form);
    if (selected.length < 2) return showConfigError('Selecciona al menos dos colores para el ejercicio Stroop.');
    const instruction = (form.querySelector<HTMLInputElement>('input[name="stroopInstruction"]:checked')?.value ?? 'ink') as StroopInstruction;
    const allowMatches = form.querySelector<HTMLInputElement>('#allowMatches')?.checked ?? false;
    return { kind: 'stroop', ...base, colors: selected, instruction, allowMatches };
  }

  const rawWords = form.querySelector<HTMLTextAreaElement>('#wordList')?.value ?? '';
  const words = uniqueWords(rawWords);
  if (words.length < 2) return showConfigError('Escribe al menos dos palabras diferentes.');
  return { kind: 'words', ...base, words };
}

function showConfigError(message: string): null {
  const error = app.querySelector<HTMLParagraphElement>('#form-error');
  if (error) {
    error.textContent = message;
    error.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  return null;
}

function selectedColors(form: HTMLFormElement): ColorId[] {
  return Array.from(form.querySelectorAll<HTMLInputElement>('input[name="color"]:checked')).map((element) => element.value as ColorId);
}

function uniqueWords(raw: string): string[] {
  const seen: Record<string, boolean> = {};
  const words: string[] = [];
  raw.split(/\n|,/).forEach((entry) => {
    const word = entry.trim().replace(/\s+/g, ' ').toLocaleUpperCase('es');
    if (!word || seen[word]) return;
    seen[word] = true;
    words.push(word);
  });
  return words.slice(0, 30);
}

function startTraining(): void {
  clearRuntimeTimers();
  runtime = {
    createdAt: performance.now(),
    activeStartedAt: null,
    startedAtIso: new Date().toISOString(),
    trials: [],
    currentStimulus: null,
    lastStimulusKey: null,
    phase: settings.countdown ? 'countdown' : 'waiting',
  };
  screen = 'training';
  render();
  if (settings.countdown) beginCountdown();
  else {
    if (runtime) runtime.activeStartedAt = performance.now();
    scheduleNextStimulus();
  }
}

function renderTraining(): void {
  const meta = exerciseMeta[selectedExercise];
  const progressHidden = settings.showProgress ? '' : ' training-progress-hidden';

  app.innerHTML = `
    <main class="training-screen training-screen-passive">
      <header class="training-header">
        <button class="training-exit" data-action="back" aria-label="Detener y volver">←</button>
        <div class="training-heading"><strong>${meta.title}</strong><span>${trainingSubtitle()}</span></div>
        <button class="training-stop" data-action="stop">Detener</button>
      </header>

      <div class="training-progress${progressHidden}" aria-hidden="true"><span id="progress-fill"></span></div>
      <div class="training-meta${progressHidden}"><span>Estímulos completados</span><strong id="trial-counter">0 / ${configs[selectedExercise].repetitions}</strong></div>

      <section class="training-stage training-stage-passive">
        <div class="elapsed-block"><strong id="elapsed-time">0:00</strong><span>Tiempo transcurrido</span></div>
        <div class="stimulus-area stimulus-area-passive" id="stimulus-area">
          <div class="countdown" id="countdown" ${settings.countdown ? '' : 'hidden'}>${settings.countdown ? '3' : ''}</div>
          <div class="main-stimulus stimulus-${selectedExercise}" id="main-stimulus" aria-live="off"></div>
        </div>
      </section>

      <p class="training-motto"><span></span> CONCENTRACIÓN EN CADA SEGUNDO <span></span></p>
    </main>`;

  const stop = () => stopTraining();
  app.querySelector<HTMLButtonElement>('[data-action="back"]')?.addEventListener('click', stop);
  app.querySelector<HTMLButtonElement>('[data-action="stop"]')?.addEventListener('click', stop);
  startElapsedClock();
}

function trainingSubtitle(): string {
  const config = configs[selectedExercise];
  if (config.kind === 'stroop') return config.instruction === 'ink' ? 'Consigna: color visible' : 'Consigna: palabra escrita';
  return 'Sesión en curso';
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
  const config = configs[selectedExercise];
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
  const config = configs[selectedExercise];
  const stimulus = createNonRepeatingStimulus(config, runtime.lastStimulusKey);
  runtime.currentStimulus = stimulus;
  runtime.lastStimulusKey = stimulus.key;
  runtime.phase = 'active';

  requestAnimationFrame(() => {
    if (!runtime || runtime.phase !== 'active' || runtime.currentStimulus?.key !== stimulus.key) return;
    setStimulusHtml(stimulus.html);
    signalCue();
    const activeStartedAt = runtime.activeStartedAt ?? performance.now();
    const shownAt = performance.now();

    runtime.phaseTimer = window.setTimeout(() => {
      if (!runtime || runtime.phase !== 'active' || runtime.currentStimulus?.key !== stimulus.key) return;
      runtime.trials.push({
        stimulus: stimulus.label,
        shownAtMs: shownAt - activeStartedAt,
        visibleForMs: performance.now() - shownAt,
      });
      runtime.currentStimulus = null;
      setStimulusHtml('');
      updateTrainingProgress();

      if (runtime.trials.length >= config.repetitions) void finishTraining();
      else scheduleNextStimulus();
    }, config.stimulusDurationMs);
  });
}

function createNonRepeatingStimulus(config: ExerciseConfig, previousKey: string | null): Stimulus {
  let stimulus = createStimulus(config);
  let attempts = 0;
  while (stimulus.key === previousKey && attempts < 6) {
    stimulus = createStimulus(config);
    attempts += 1;
  }
  return stimulus;
}

function createStimulus(config: ExerciseConfig): Stimulus {
  if (config.kind === 'arrows') {
    const direction = randomItem(config.directions);
    return {
      key: direction,
      label: directions[direction].label,
      html: arrowSvg(direction, 'stimulus-svg'),
    };
  }

  if (config.kind === 'numbers') {
    const value = randomInteger(config.minNumber, config.maxNumber);
    return {
      key: `n-${value}`,
      label: String(value),
      html: `<span class="stimulus-number-text">${value}</span>`,
    };
  }

  if (config.kind === 'colors') {
    const color = randomItem(config.colors);
    return {
      key: `c-${color}`,
      label: colors[color].label,
      html: `<span class="stimulus-color-disc" style="--stimulus-color:${colors[color].hex}" aria-label="${colors[color].label}"></span>`,
    };
  }

  if (config.kind === 'color-number') {
    const value = randomInteger(config.minNumber, config.maxNumber);
    const color = randomItem(config.colors);
    return {
      key: `cn-${color}-${value}`,
      label: `${colors[color].label} ${value}`,
      html: `<span class="stimulus-colored-number" style="--stimulus-color:${colors[color].hex}">${value}</span>`,
    };
  }

  if (config.kind === 'stroop') {
    const wordColor = randomItem(config.colors);
    let inkColor = randomItem(config.colors);
    if (!config.allowMatches && config.colors.length > 1) {
      while (inkColor === wordColor) inkColor = randomItem(config.colors);
    }
    return {
      key: `s-${wordColor}-${inkColor}`,
      label: `${colors[wordColor].label} / ${colors[inkColor].label}`,
      html: `<span class="stimulus-stroop-word" style="--stimulus-color:${colors[inkColor].hex}">${escapeHtml(colors[wordColor].label.toLocaleUpperCase('es'))}</span>`,
    };
  }

  const word = randomItem(config.words);
  return {
    key: `w-${word}`,
    label: word,
    html: `<span class="stimulus-word-text">${escapeHtml(word)}</span>`,
  };
}

function updateTrainingProgress(): void {
  if (!runtime) return;
  const total = configs[selectedExercise].repetitions;
  const completed = runtime.trials.length;
  const counter = app.querySelector<HTMLElement>('#trial-counter');
  const fill = app.querySelector<HTMLElement>('#progress-fill');
  if (counter) counter.textContent = `${completed} / ${total}`;
  if (fill) fill.style.width = `${Math.min(100, completed / total * 100)}%`;
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

  const config = cloneConfig(configs[selectedExercise]);
  const activeStartedAt = runtime.activeStartedAt ?? runtime.createdAt;
  const durationMs = Math.max(0, performance.now() - activeStartedAt);

  lastSession = {
    schemaVersion: 3,
    id: createId(),
    exercise: selectedExercise,
    startedAt: runtime.startedAtIso,
    finishedAt: new Date().toISOString(),
    config,
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
  const meta = exerciseMeta[session.exercise];

  app.innerHTML = `
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
        ${statCard('Estímulos', `${summary.completed} / ${summary.planned}`, meta.symbol)}
        ${statCard('Duración', formatDuration(summary.durationMs), '◷')}
        ${statCard('Señal visible', formatSeconds(summary.stimulusDurationMs), 'ϟ')}
        ${statCard(resultDetailLabel(session.config), resultDetailValue(session.config), '✣')}
      </section>

      <section class="session-detail-card">
        <h2>Configuración utilizada</h2>
        <dl class="session-detail-list">
          <div><dt>Espera entre señales</dt><dd>${formatSeconds(session.config.waitMinMs)} – ${formatSeconds(session.config.waitMaxMs)}</dd></div>
          ${specificResultDetails(session.config)}
        </dl>
      </section>

      <div class="result-actions result-actions-three">
        <button class="secondary-button" data-action="save-preset">Guardar preset</button>
        <button class="primary-button" data-action="repeat">↻ &nbsp; Repetir</button>
        <button class="text-button" data-action="back">Volver al inicio</button>
      </div>
    </main>`;

  app.querySelectorAll<HTMLButtonElement>('[data-action="back"]').forEach((button) => button.addEventListener('click', () => navigate('home')));
  app.querySelector<HTMLButtonElement>('[data-action="repeat"]')?.addEventListener('click', () => {
    selectedExercise = session.exercise;
    configs[selectedExercise] = cloneConfig(session.config);
    prepareAudio();
    startTraining();
  });
  app.querySelector<HTMLButtonElement>('[data-action="save-preset"]')?.addEventListener('click', () => openPresetNameModal(session.config));
}

function statCard(label: string, value: string, symbol: string): string {
  return `<div class="stat-card"><span>${symbol}</span><div><small>${label}</small><strong>${value}</strong></div></div>`;
}

function resultDetailLabel(config: ExerciseConfig): string {
  if (config.kind === 'arrows') return 'Direcciones';
  if (config.kind === 'numbers') return 'Rango';
  if (config.kind === 'colors') return 'Colores';
  if (config.kind === 'color-number') return 'Combinación';
  if (config.kind === 'stroop') return 'Consigna';
  return 'Palabras';
}

function resultDetailValue(config: ExerciseConfig): string {
  if (config.kind === 'arrows') return String(config.directions.length);
  if (config.kind === 'numbers') return `${config.minNumber}–${config.maxNumber}`;
  if (config.kind === 'colors') return String(config.colors.length);
  if (config.kind === 'color-number') return `${config.colors.length} × ${config.maxNumber - config.minNumber + 1}`;
  if (config.kind === 'stroop') return config.instruction === 'ink' ? 'Color' : 'Palabra';
  return String(config.words.length);
}

function specificResultDetails(config: ExerciseConfig): string {
  if (config.kind === 'arrows') {
    return `<div><dt>Direcciones activas</dt><dd>${config.directions.map((direction) => directions[direction].symbol).join(' ')}</dd></div>`;
  }
  if (config.kind === 'numbers') {
    return `<div><dt>Números posibles</dt><dd>${config.minNumber} a ${config.maxNumber}</dd></div>`;
  }
  if (config.kind === 'colors') {
    return `<div><dt>Colores activos</dt><dd>${config.colors.map((color) => colors[color].label).join(', ')}</dd></div>`;
  }
  if (config.kind === 'color-number') {
    return `<div><dt>Rango numérico</dt><dd>${config.minNumber} a ${config.maxNumber}</dd></div><div><dt>Colores activos</dt><dd>${config.colors.map((color) => colors[color].label).join(', ')}</dd></div>`;
  }
  if (config.kind === 'stroop') {
    return `<div><dt>Responder a</dt><dd>${config.instruction === 'ink' ? 'Color visible' : 'Palabra escrita'}</dd></div><div><dt>Coincidencias</dt><dd>${config.allowMatches ? 'Permitidas' : 'Evitadas'}</dd></div>`;
  }
  return `<div><dt>Consignas</dt><dd>${config.words.join(', ')}</dd></div>`;
}

async function renderHistory(): Promise<void> {
  app.innerHTML = `
    <main class="app-shell history-screen">
      <header class="topbar">
        <button class="icon-button" data-action="back" aria-label="Volver">←</button>
        <div><h1>Historial</h1><p>Sesiones de entrenamiento guardadas</p></div>
        <div class="topbar-spacer"></div>
      </header>
      <div class="history-filter-row" id="history-filters"></div>
      <div class="history-list" id="history-list"><p class="loading">Cargando…</p></div>
    </main>`;

  app.querySelector<HTMLButtonElement>('[data-action="back"]')?.addEventListener('click', () => navigate('home'));
  const sessions = await listSessions();
  if (screen !== 'history') return;
  renderHistoryContent(sessions, 'all');
}

function renderHistoryContent(sessions: StoredSession[], filter: ExerciseId | 'all'): void {
  const filters = app.querySelector<HTMLDivElement>('#history-filters');
  const list = app.querySelector<HTMLDivElement>('#history-list');
  if (!filters || !list) return;

  const usedExercises = exerciseIds().filter((id) => sessions.some((session) => session.exercise === id));
  filters.innerHTML = [
    `<button class="filter-chip ${filter === 'all' ? 'is-active' : ''}" data-filter="all">Todos</button>`,
    ...usedExercises.map((id) => `<button class="filter-chip ${filter === id ? 'is-active' : ''}" data-filter="${id}">${exerciseMeta[id].title}</button>`),
  ].join('');

  filters.querySelectorAll<HTMLButtonElement>('[data-filter]').forEach((button) => {
    button.addEventListener('click', () => renderHistoryContent(sessions, button.dataset.filter as ExerciseId | 'all'));
  });

  const visible = filter === 'all' ? sessions : sessions.filter((session) => session.exercise === filter);
  if (!visible.length) {
    list.innerHTML = '<div class="empty-state"><div>◷</div><h2>Todavía no hay sesiones</h2><p>Completa un entrenamiento y aparecerá aquí.</p><button class="primary-button" data-action="train">Entrenar ahora</button></div>';
    list.querySelector<HTMLButtonElement>('[data-action="train"]')?.addEventListener('click', () => navigate('home'));
    return;
  }

  list.innerHTML = visible.map((session) => {
    const meta = exerciseMeta[session.exercise] ?? exerciseMeta.arrows;
    const date = new Date(session.finishedAt);
    return `<article class="history-card">
      <div class="history-symbol history-symbol-${session.exercise}">${meta.symbol}</div>
      <div class="history-copy"><strong>${meta.title}</strong><span>${date.toLocaleDateString('es-AR')} · ${date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</span></div>
      <div class="history-score"><strong>${session.summary.completed} estímulos</strong><span>${formatDuration(session.summary.durationMs)}</span></div>
    </article>`;
  }).join('');
}

async function renderPresets(): Promise<void> {
  app.innerHTML = `
    <main class="app-shell presets-screen">
      <header class="topbar">
        <button class="icon-button" data-action="back" aria-label="Volver">←</button>
        <div><h1>Presets</h1><p>Configuraciones listas para reutilizar</p></div>
        <div class="topbar-spacer"></div>
      </header>
      <div class="preset-list" id="preset-list"><p class="loading">Cargando…</p></div>
    </main>`;

  app.querySelector<HTMLButtonElement>('[data-action="back"]')?.addEventListener('click', () => navigate('home'));
  const presets = await listPresets();
  if (screen !== 'presets') return;

  const list = app.querySelector<HTMLDivElement>('#preset-list');
  if (!list) return;
  if (!presets.length) {
    list.innerHTML = `
      <div class="empty-state">
        <div>≡</div><h2>No hay presets guardados</h2>
        <p>Configura cualquier entrenamiento y pulsa “Guardar preset”.</p>
        <button class="primary-button" data-action="train">Elegir entrenamiento</button>
      </div>`;
    list.querySelector<HTMLButtonElement>('[data-action="train"]')?.addEventListener('click', () => navigate('home'));
    return;
  }

  list.innerHTML = presets.map((preset) => {
    const meta = exerciseMeta[preset.exercise];
    return `<article class="preset-card">
      <div class="preset-symbol">${meta.symbol}</div>
      <div class="preset-main"><strong>${escapeHtml(preset.name)}</strong><span>${meta.title} · ${preset.config.repetitions} estímulos</span><small>${presetConfigSummary(preset.config)}</small></div>
      <div class="preset-actions"><button data-use="${preset.id}" class="mini-primary">Usar</button><button data-delete="${preset.id}" class="mini-danger" aria-label="Eliminar ${escapeHtml(preset.name)}">Eliminar</button></div>
    </article>`;
  }).join('');

  list.querySelectorAll<HTMLButtonElement>('[data-use]').forEach((button) => {
    button.addEventListener('click', () => {
      const preset = presets.find((item) => item.id === button.dataset.use);
      if (!preset) return;
      selectedExercise = preset.exercise;
      configs[selectedExercise] = cloneConfig(preset.config);
      navigate('config');
    });
  });

  list.querySelectorAll<HTMLButtonElement>('[data-delete]').forEach((button) => {
    button.addEventListener('click', () => {
      const preset = presets.find((item) => item.id === button.dataset.delete);
      if (!preset) return;
      openConfirmModal('Eliminar preset', `Se eliminará “${preset.name}”. Esta acción no afecta tu historial.`, 'Eliminar', async () => {
        await deletePreset(preset.id);
        if (screen === 'presets') void renderPresets();
      });
    });
  });
}

function presetConfigSummary(config: ExerciseConfig): string {
  const base = `${formatSeconds(config.waitMinMs)}–${formatSeconds(config.waitMaxMs)} de espera · ${formatSeconds(config.stimulusDurationMs)} visible`;
  if (config.kind === 'arrows') return `${config.directions.length} direcciones · ${base}`;
  if (config.kind === 'numbers') return `${config.minNumber}–${config.maxNumber} · ${base}`;
  if (config.kind === 'colors') return `${config.colors.length} colores · ${base}`;
  if (config.kind === 'color-number') return `${config.colors.length} colores · números ${config.minNumber}–${config.maxNumber} · ${base}`;
  if (config.kind === 'stroop') return `${config.instruction === 'ink' ? 'Color visible' : 'Palabra escrita'} · ${base}`;
  return `${config.words.length} palabras · ${base}`;
}

function renderSettings(): void {
  const version = getAppVersion();
  app.innerHTML = `
    <main class="app-shell settings-screen">
      <header class="topbar">
        <button class="icon-button" data-action="back" aria-label="Volver">←</button>
        <div><h1>Ajustes</h1><p>Personaliza la experiencia de entrenamiento</p></div>
        <div class="topbar-spacer"></div>
      </header>

      <section class="settings-card settings-list-card">
        <div class="section-title"><span>ϟ</span><div><h2>Durante el entrenamiento</h2><p>Se aplica a todos los modos</p></div></div>
        ${toggleRow('setting-countdown', 'Cuenta regresiva', 'Mostrar 3, 2, 1 y “¡Ya!” antes de comenzar', settings.countdown)}
        ${toggleRow('setting-progress', 'Mostrar progreso', 'Ver cantidad de estímulos completados', settings.showProgress)}
        ${toggleRow('setting-sound', 'Sonido de señal', 'Emitir un tono breve cuando aparece el estímulo', settings.sound)}
        ${toggleRow('setting-vibration', 'Vibración', 'Vibrar brevemente cuando aparece el estímulo', settings.vibration)}
      </section>

      <section class="settings-card settings-list-card">
        <div class="section-title"><span>⌁</span><div><h2>Datos locales</h2><p>Todo permanece guardado solamente en este dispositivo</p></div></div>
        <button class="settings-action-row" data-action="clear-history"><span><strong>Borrar historial</strong><small>Elimina todas las sesiones guardadas</small></span><b>›</b></button>
        <button class="settings-action-row" data-action="clear-presets"><span><strong>Borrar presets</strong><small>Elimina todas las configuraciones guardadas</small></span><b>›</b></button>
      </section>

      <section class="about-card">
        <div class="brand-mark about-brand">ϟ</div>
        <div><strong>Entrenador Digital</strong><span>Versión ${escapeHtml(version)}</span><small>Aplicación local y offline. Sin cuentas, nube ni telemetría.</small></div>
      </section>
    </main>`;

  app.querySelector<HTMLButtonElement>('[data-action="back"]')?.addEventListener('click', () => navigate('home'));

  const settingsBindings: Array<[string, keyof AppSettings]> = [
    ['setting-countdown', 'countdown'],
    ['setting-progress', 'showProgress'],
    ['setting-sound', 'sound'],
    ['setting-vibration', 'vibration'],
  ];
  settingsBindings.forEach(([id, key]) => {
    app.querySelector<HTMLInputElement>(`#${id}`)?.addEventListener('change', (event) => {
      settings[key] = (event.currentTarget as HTMLInputElement).checked;
      persistSettings();
      if (key === 'sound' && settings.sound) prepareAudio();
    });
  });

  app.querySelector<HTMLButtonElement>('[data-action="clear-history"]')?.addEventListener('click', () => {
    openConfirmModal('Borrar historial', 'Se eliminarán todas las sesiones guardadas en este dispositivo.', 'Borrar historial', async () => {
      await clearSessions();
    });
  });
  app.querySelector<HTMLButtonElement>('[data-action="clear-presets"]')?.addEventListener('click', () => {
    openConfirmModal('Borrar presets', 'Se eliminarán todas las configuraciones guardadas.', 'Borrar presets', async () => {
      await clearPresets();
    });
  });
}

function openPresetNameModal(config: ExerciseConfig): void {
  closeModal();
  const meta = exerciseMeta[config.kind];
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <section class="app-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <h2 id="modal-title">Guardar preset</h2>
      <p>Guarda esta configuración de ${meta.title} para volver a usarla rápidamente.</p>
      <label class="modal-field"><span>Nombre</span><input id="preset-name" type="text" maxlength="40" value="${escapeAttribute(`${meta.title} personal`)}" autocomplete="off"></label>
      <div class="modal-actions"><button class="secondary-button" data-modal-close>Cancelar</button><button class="primary-button" data-modal-save>Guardar</button></div>
    </section>`;
  document.body.appendChild(overlay);

  const input = overlay.querySelector<HTMLInputElement>('#preset-name');
  window.setTimeout(() => { input?.focus(); input?.select(); }, 50);
  overlay.querySelector<HTMLButtonElement>('[data-modal-close]')?.addEventListener('click', closeModal);
  overlay.addEventListener('click', (event) => { if (event.target === overlay) closeModal(); });
  overlay.querySelector<HTMLButtonElement>('[data-modal-save]')?.addEventListener('click', async () => {
    const name = (input?.value ?? '').trim();
    if (!name) {
      input?.focus();
      return;
    }
    await savePreset({
      schemaVersion: 1,
      id: createId(),
      name,
      exercise: config.kind,
      config: cloneConfig(config),
      createdAt: new Date().toISOString(),
    });
    closeModal();
    showToast('Preset guardado');
  });
}

function openConfirmModal(title: string, message: string, confirmLabel: string, onConfirm: () => void | Promise<void>): void {
  closeModal();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <section class="app-modal" role="dialog" aria-modal="true">
      <h2>${escapeHtml(title)}</h2>
      <p>${escapeHtml(message)}</p>
      <div class="modal-actions"><button class="secondary-button" data-modal-close>Cancelar</button><button class="danger-button" data-modal-confirm>${escapeHtml(confirmLabel)}</button></div>
    </section>`;
  document.body.appendChild(overlay);
  overlay.querySelector<HTMLButtonElement>('[data-modal-close]')?.addEventListener('click', closeModal);
  overlay.addEventListener('click', (event) => { if (event.target === overlay) closeModal(); });
  overlay.querySelector<HTMLButtonElement>('[data-modal-confirm]')?.addEventListener('click', async () => {
    await onConfirm();
    closeModal();
    showToast('Listo');
  });
}

function closeModal(): void {
  document.querySelector('.modal-overlay')?.remove();
}

function showToast(message: string): void {
  document.querySelector('.app-toast')?.remove();
  const toast = document.createElement('div');
  toast.className = 'app-toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  window.setTimeout(() => toast.classList.add('is-visible'), 20);
  window.setTimeout(() => {
    toast.classList.remove('is-visible');
    window.setTimeout(() => toast.remove(), 180);
  }, 1800);
}

function getAppVersion(): string {
  try {
    if (window.Android && typeof window.Android.getAppVersion === 'function') return window.Android.getAppVersion();
  } catch {
    // Browser preview: fall through to the development version.
  }
  return '0.1.0';
}

function prepareAudio(): void {
  if (!settings.sound) return;
  try {
    if (!audioContext) audioContext = new AudioContext();
    if (audioContext.state === 'suspended') void audioContext.resume();
  } catch {
    audioContext = null;
  }
}

function signalCue(): void {
  if (settings.vibration) {
    try {
      if (window.Android && typeof window.Android.vibrate === 'function') window.Android.vibrate(35);
      else if (navigator.vibrate) navigator.vibrate(35);
    } catch {
      // Optional enhancement only.
    }
  }

  if (!settings.sound) return;
  try {
    prepareAudio();
    if (!audioContext) return;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(0.08, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.075);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.08);
  } catch {
    // Sound is optional and must never interrupt training.
  }
}

function randomItem<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)] as T;
}

function randomInteger(min: number, max: number): number {
  return Math.floor(min + Math.random() * (max - min + 1));
}

function randomBetween(min: number, max: number): number {
  return Math.floor(min + Math.random() * (max - min));
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

function createId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function exerciseIds(): ExerciseId[] {
  return ['arrows', 'numbers', 'colors', 'color-number', 'stroop', 'words'];
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  }[character] ?? character));
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replace(/`/g, '&#96;');
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

const DB_NAME = 'entrenador-digital';
const DB_VERSION = 3;
const SESSION_STORE = 'sessions';
const PRESET_STORE = 'presets';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SESSION_STORE)) {
        const sessions = db.createObjectStore(SESSION_STORE, { keyPath: 'id' });
        sessions.createIndex('finishedAt', 'finishedAt');
      }
      if (!db.objectStoreNames.contains(PRESET_STORE)) {
        const presets = db.createObjectStore(PRESET_STORE, { keyPath: 'id' });
        presets.createIndex('createdAt', 'createdAt');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveSession(session: StoredSession): Promise<void> {
  await putRecord(SESSION_STORE, session);
}

async function savePreset(preset: Preset): Promise<void> {
  await putRecord(PRESET_STORE, preset);
}

async function putRecord(storeName: string, value: StoredSession | Preset): Promise<void> {
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      transaction.objectStore(storeName).put(value);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    db.close();
  } catch (error) {
    console.error(`No se pudo guardar en ${storeName}`, error);
  }
}

async function listSessions(): Promise<StoredSession[]> {
  const values = await listRecords<StoredSession>(SESSION_STORE);
  return values.sort((a, b) => b.finishedAt.localeCompare(a.finishedAt));
}

async function listPresets(): Promise<Preset[]> {
  const values = await listRecords<Preset>(PRESET_STORE);
  return values.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

async function listRecords<T>(storeName: string): Promise<T[]> {
  try {
    const db = await openDatabase();
    const values = await new Promise<T[]>((resolve, reject) => {
      const result: T[] = [];
      const request = db.transaction(storeName, 'readonly').objectStore(storeName).openCursor();
      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          result.push(cursor.value as T);
          cursor.continue();
        } else resolve(result);
      };
      request.onerror = () => reject(request.error);
    });
    db.close();
    return values;
  } catch (error) {
    console.error(`No se pudo leer ${storeName}`, error);
    return [];
  }
}

async function deletePreset(id: string): Promise<void> {
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(PRESET_STORE, 'readwrite');
      transaction.objectStore(PRESET_STORE).delete(id);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    db.close();
  } catch (error) {
    console.error('No se pudo eliminar el preset', error);
  }
}

async function clearSessions(): Promise<void> {
  await clearStore(SESSION_STORE);
}

async function clearPresets(): Promise<void> {
  await clearStore(PRESET_STORE);
}

async function clearStore(storeName: string): Promise<void> {
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      transaction.objectStore(storeName).clear();
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    db.close();
  } catch (error) {
    console.error(`No se pudo borrar ${storeName}`, error);
  }
}

render();
