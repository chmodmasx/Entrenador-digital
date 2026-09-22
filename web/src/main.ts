import './styles.css';
import './passive.css';
import './sections.css';
import {
  cognitiveConfigSection,
  cognitiveDefaults,
  cognitiveResultDetailLabel,
  cognitiveResultDetailValue,
  cognitiveResultDetails,
  cognitiveTrainingNote,
  cognitiveTrainingSubtitle,
  isCognitiveExercise,
  mountCognitiveGame,
  readCognitiveConfig,
  type CognitiveConfig,
  type CognitiveController,
} from './cognitive-games';
import { timingPolicy } from './training-timing';
import { bindSteppers, parseLocaleNumber, renderStepper } from './components/stepper';
import {
  COLOR_IDS,
  DEFAULT_WORDS,
  DIRECTION_IDS,
  EXERCISE_IDS,
  EXERCISE_META,
  type CognitiveExerciseId,
  type ColorId,
  type DirectionId as Direction,
  type ExerciseId,
  type StroopInstruction,
} from './domain/exercises';
import { validateBaseTrainingValues } from './domain/validation';
import { DEFAULT_APP_SETTINGS, type AppSettings } from './domain/settings';
import { getNativeAppVersion, nativeVibrate, setNativeTrainingMode } from './platform/native-bridge';
import { exportBackup, requestBackupImport } from './backup';
import { profileEnhanceCurrentScreen } from './profiles';
import { mountHomeScreen } from './screens/home';
import { mountSettingsScreen } from './screens/settings';
import { mountHistoryScreen } from './screens/history';
import {
  SESSION_STORE,
  clearStore as dbClearStore,
  listRecords as dbListRecords,
  putRecord as dbPutRecord,
} from './storage/database';


type Screen = 'home' | 'config' | 'training' | 'results' | 'history' | 'settings';

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

type ExerciseConfig = ArrowsConfig | NumbersConfig | ColorsConfig | ColorNumberConfig | StroopConfig | WordsConfig | CognitiveConfig;

interface Stimulus {
  key: string;
  label: string;
  html: string;
}

interface TrialResult {
  stimulus: string;
  shownAtMs: number;
  visibleForMs: number;
  correct?: boolean;
  responseMs?: number;
}

interface SessionSummary {
  completed: number;
  planned: number;
  durationMs: number;
  stimulusDurationMs: number;
  scored?: number;
  correct?: number;
  accuracy?: number;
  averageResponseMs?: number;
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

const directionOrder: Direction[] = [...DIRECTION_IDS];

const colors: Record<ColorId, { label: string; hex: string }> = {
  blue: { label: 'Azul', hex: '#019CE8' },
  red: { label: 'Rojo', hex: '#E44B4B' },
  green: { label: 'Verde', hex: '#22A86A' },
  yellow: { label: 'Amarillo', hex: '#F4C542' },
  orange: { label: 'Naranja', hex: '#F28A2E' },
  violet: { label: 'Violeta', hex: '#8A5CF6' },
};

const colorOrder: ColorId[] = [...COLOR_IDS];

const exerciseMeta = EXERCISE_META;

function defaultTiming(kind: ExerciseId): Pick<BaseConfig, 'waitMinMs' | 'waitMaxMs' | 'stimulusDurationMs'> {
  const policy = timingPolicy(kind);
  return {
    waitMinMs: Math.round(policy.defaultWaitMin * 1000),
    waitMaxMs: Math.round(policy.defaultWaitMax * 1000),
    stimulusDurationMs: Math.round(policy.defaultDuration * 1000),
  };
}

const defaultConfigs: Record<ExerciseId, ExerciseConfig> = {
  arrows: {
    kind: 'arrows',
    repetitions: 20,
    ...defaultTiming('arrows'),
    directions: [...directionOrder],
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
    colors: [...colorOrder],
  },
  'color-number': {
    kind: 'color-number',
    repetitions: 20,
    ...defaultTiming('color-number'),
    minNumber: 1,
    maxNumber: 9,
    colors: [...colorOrder],
  },
  stroop: {
    kind: 'stroop',
    repetitions: 20,
    ...defaultTiming('stroop'),
    colors: [...colorOrder],
    instruction: 'ink',
    allowMatches: false,
  },
  words: {
    kind: 'words',
    repetitions: 20,
    ...defaultTiming('words'),
    words: [...DEFAULT_WORDS],
  },
  flow: cognitiveDefaults.flow,
  'memory-match': cognitiveDefaults['memory-match'],
  'memory-matrix': cognitiveDefaults['memory-matrix'],
  'spatial-match': cognitiveDefaults['spatial-match'],
  'star-search': cognitiveDefaults['star-search'],
  'rule-shift': cognitiveDefaults['rule-shift'],
};

const SETTINGS_KEY = 'entrenador-digital-settings-v1';
const defaultSettings: AppSettings = { ...DEFAULT_APP_SETTINGS };

let settings = loadSettings();
let screen: Screen = 'home';
let selectedExercise: ExerciseId = 'arrows';
let configs: Record<ExerciseId, ExerciseConfig> = cloneConfigMap(defaultConfigs);
let runtime: RuntimeSession | null = null;
let cognitiveController: CognitiveController | null = null;
let lastSession: StoredSession | null = null;
let audioContext: AudioContext | null = null;
let quickStartRequested = false;

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
    flow: cloneConfig(source.flow),
    'memory-match': cloneConfig(source['memory-match']),
    'memory-matrix': cloneConfig(source['memory-matrix']),
    'spatial-match': cloneConfig(source['spatial-match']),
    'star-search': cloneConfig(source['star-search']),
    'rule-shift': cloneConfig(source['rule-shift']),
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

function navigate(next: Screen): void {
  screen = next;
  window.scrollTo(0, 0);
  render();
}

function render(): void {
  const training = screen === 'training';
  document.body.classList.toggle('is-training', training);
  document.body.classList.toggle('is-home', screen === 'home');
  setNativeTrainingMode(training);

  if (screen === 'home') renderHome();
  if (screen === 'config') renderConfig();
  if (screen === 'training') renderTraining();
  if (screen === 'results') renderResults();
  if (screen === 'history') void renderHistory();
  if (screen === 'settings') renderSettings();

  profileEnhanceCurrentScreen();

  if (screen === 'config' && quickStartRequested) {
    quickStartRequested = false;
    app.querySelector<HTMLFormElement>('#exercise-config')?.requestSubmit();
  }
}

function renderHome(): void {
  mountHomeScreen(app, {
    onConfigure: (exercise) => {
      selectedExercise = exercise;
      navigate('config');
    },
    onQuickStart: (exercise) => {
      selectedExercise = exercise;
      quickStartRequested = true;
      navigate('config');
    },
    onHistory: () => navigate('history'),
    onSettings: () => navigate('settings'),
  });
}

function renderConfig(): void {
  const meta = exerciseMeta[selectedExercise];
  const config = configs[selectedExercise];

  app.innerHTML = `
    <main class="app-shell config-screen" data-exercise-id="${selectedExercise}">
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

        ${isCognitiveExercise(config.kind)
          ? cognitiveTrainingNote(config.kind)
          : `<div class="training-mode-note">
              <span>i</span>
              <div><strong>Entrenamiento físico</strong>La app muestra las señales automáticamente. La respuesta se realiza fuera de la pantalla, durante el ejercicio real.</div>
            </div>`}

        <p class="form-error" id="form-error" role="alert"></p>
        <div class="config-actions">
          <button class="primary-button start-button" type="submit"><span>▶</span> Iniciar entrenamiento</button>
        </div>
      </form>
    </main>`;

  app.querySelector<HTMLButtonElement>('[data-action="back"]')?.addEventListener('click', () => navigate('home'));
  bindConfigSteppers();
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


}

function sharedConfigSections(config: ExerciseConfig): string {
  const cognitive = isCognitiveExercise(config.kind);
  const policy = timingPolicy(config.kind);
  const randomizedPause = policy.pauseMode === 'random';
  const countUnit = cognitive ? 'rondas' : 'señales';
  const pauseValue = Math.round(((config.waitMinMs + config.waitMaxMs) / 2000) * 10) / 10;
  const durationLabel = config.kind === 'memory-matrix'
    ? 'Tiempo para memorizar'
    : config.kind === 'star-search'
      ? 'Tiempo máximo de búsqueda'
      : cognitive ? 'Tiempo máximo para responder' : 'Duración visible';
  const durationSubtitle = config.kind === 'memory-matrix'
    ? 'Cuánto tiempo permanece visible la matriz'
    : cognitive ? 'Límite de tiempo de cada ronda' : 'Cuánto tiempo permanece visible cada señal';

  const timingSection = randomizedPause
    ? `
      <section class="settings-card">
        <div class="section-title"><span>◴</span><div><h2>${cognitive ? 'Pausa entre rondas' : 'Aparición'}</h2><p>${cognitive ? 'Varía el inicio para que el ritmo no sea predecible' : 'Evita que el ritmo sea predecible'}</p></div></div>
        ${stepper('waitMin', 'Espera mínima', config.waitMinMs / 1000, 's', policy.pauseMin, policy.pauseMax - 0.1, 0.1)}
        ${stepper('waitMax', 'Espera máxima', config.waitMaxMs / 1000, 's', policy.pauseMin + 0.1, policy.pauseMax, 0.1)}
      </section>`
    : `
      <section class="settings-card">
        <div class="section-title"><span>◴</span><div><h2>Pausa entre rondas</h2><p>Tiempo fijo antes de comenzar la siguiente ronda</p></div></div>
        ${stepper('roundPause', 'Duración de la pausa', pauseValue, 's', policy.pauseMin, policy.pauseMax, 0.1)}
      </section>`;

  return `
    <section class="settings-card">
      <div class="section-title"><span>◷</span><div><h2>Sesión</h2><p>Define cuántas ${countUnit} tendrá el entrenamiento</p></div></div>
      ${stepper('repetitions', cognitive ? 'Cantidad de rondas' : 'Cantidad de estímulos', config.repetitions, countUnit, 2, 200, 1)}
    </section>

    ${timingSection}

    <section class="settings-card">
      <div class="section-title"><span>ϟ</span><div><h2>${cognitive ? 'Ronda' : 'Estímulo'}</h2><p>${durationSubtitle}</p></div></div>
      ${stepper('stimulusDuration', durationLabel, config.stimulusDurationMs / 1000, 's', policy.durationMin, policy.durationMax, 0.1)}
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

  if (config.kind === 'words') {
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

  return cognitiveConfigSection(config);
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

const stepper = renderStepper;


function bindConfigSteppers(): void {
  bindSteppers(app);
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
  const raw = app.querySelector<HTMLInputElement>(`#${id}`)?.value ?? '';
  return parseLocaleNumber(raw) ?? Number.NaN;
}

function readBaseConfig(): BaseConfig | null {
  const roundPauseInput = app.querySelector<HTMLInputElement>('#roundPause');
  const waitMin = roundPauseInput ? numberInput('roundPause') : numberInput('waitMin');
  const waitMax = roundPauseInput ? waitMin : numberInput('waitMax');
  const validation = validateBaseTrainingValues(selectedExercise, {
    repetitions: numberInput('repetitions'),
    waitMin,
    waitMax,
    stimulusDuration: numberInput('stimulusDuration'),
  });

  if (!validation.ok) return showConfigError(validation.error);
  return {
    repetitions: validation.value.repetitions,
    waitMinMs: Math.round(validation.value.waitMin * 1000),
    waitMaxMs: Math.round(validation.value.waitMax * 1000),
    stimulusDurationMs: Math.round(validation.value.stimulusDuration * 1000),
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

  if (isCognitiveExercise(selectedExercise)) {
    const result = readCognitiveConfig(selectedExercise, form, base);
    if (!result.config) return showConfigError(result.error ?? 'Revisa la configuración del juego.');
    return result.config;
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
  cognitiveController?.stop();
  cognitiveController = null;
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
    if (isCognitiveExercise(selectedExercise)) (cognitiveController as CognitiveController | null)?.start();
    else scheduleNextStimulus();
  }
}

function renderTraining(): void {
  if (isCognitiveExercise(selectedExercise)) {
    renderCognitiveTraining(selectedExercise);
    return;
  }
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

function renderCognitiveTraining(exercise: CognitiveExerciseId): void {
  const meta = exerciseMeta[exercise];
  const config = configs[exercise] as CognitiveConfig;
  const progressHidden = settings.showProgress ? '' : ' training-progress-hidden';

  app.innerHTML = `
    <main class="training-screen training-screen-cognitive">
      <header class="training-header">
        <button class="training-exit" data-action="back" aria-label="Detener y volver">←</button>
        <div class="training-heading"><strong>${meta.title}</strong><span>${cognitiveTrainingSubtitle(exercise, config)}</span></div>
        <button class="training-stop" data-action="stop">Detener</button>
      </header>

      <div class="training-progress${progressHidden}" aria-hidden="true"><span id="progress-fill"></span></div>
      <div class="training-meta${progressHidden}"><span>Rondas completadas</span><strong id="trial-counter">0 / ${config.repetitions}</strong></div>

      <section class="training-stage cognitive-training-stage">
        <div class="cognitive-stage">
          <div class="countdown" id="countdown" ${settings.countdown ? '' : 'hidden'}>${settings.countdown ? '3' : ''}</div>
          <div class="cognitive-game-root" id="cognitive-game-root"></div>
        </div>
      </section>
    </main>`;

  const root = app.querySelector<HTMLElement>('#cognitive-game-root');
  if (!root) return;

  cognitiveController = mountCognitiveGame({
    root,
    exercise,
    config,
    onSignal: signalCue,
    onTrial: (trial) => {
      if (!runtime) return;
      const activeStartedAt = runtime.activeStartedAt ?? trial.startedAt;
      runtime.trials.push({
        stimulus: trial.stimulus,
        shownAtMs: Math.max(0, trial.startedAt - activeStartedAt),
        visibleForMs: trial.responseMs,
        correct: trial.correct,
        responseMs: trial.responseMs,
      });
      updateTrainingProgress();
    },
    onComplete: () => { void finishTraining(); },
  });

  const stop = () => stopTraining();
  app.querySelector<HTMLButtonElement>('[data-action="back"]')?.addEventListener('click', stop);
  app.querySelector<HTMLButtonElement>('[data-action="stop"]')?.addEventListener('click', stop);
  startElapsedClock();
}

function trainingSubtitle(): string {
  const config = configs[selectedExercise];
  if (isCognitiveExercise(selectedExercise)) return cognitiveTrainingSubtitle(selectedExercise, config as CognitiveConfig);
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
    if (isCognitiveExercise(selectedExercise)) (cognitiveController as CognitiveController | null)?.start();
    else scheduleNextStimulus();
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

  if (config.kind === 'words') {
    const word = randomItem(config.words);
    return {
      key: `w-${word}`,
      label: word,
      html: `<span class="stimulus-word-text">${escapeHtml(word)}</span>`,
    };
  }

  throw new Error(`El juego ${config.kind} usa su propio motor interactivo.`);
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
  cognitiveController?.stop();
  cognitiveController = null;
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
  cognitiveController?.stop();
  cognitiveController = null;

  const config = cloneConfig(configs[selectedExercise]);
  const activeStartedAt = runtime.activeStartedAt ?? runtime.createdAt;
  const durationMs = Math.max(0, performance.now() - activeStartedAt);
  const scoredTrials = runtime.trials.filter((trial) => typeof trial.correct === 'boolean');
  const correctTrials = scoredTrials.filter((trial) => trial.correct).length;
  const responseSamples = scoredTrials
    .map((trial) => trial.responseMs)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  const averageResponseMs = responseSamples.length
    ? responseSamples.reduce((sum, value) => sum + value, 0) / responseSamples.length
    : undefined;

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
      ...(scoredTrials.length ? {
        scored: scoredTrials.length,
        correct: correctTrials,
        accuracy: correctTrials / scoredTrials.length,
        averageResponseMs,
      } : {}),
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

  app.querySelectorAll<HTMLButtonElement>('[data-action="back"]').forEach((button) => button.addEventListener('click', () => navigate('home')));
  app.querySelector<HTMLButtonElement>('[data-action="repeat"]')?.addEventListener('click', () => {
    selectedExercise = session.exercise;
    configs[selectedExercise] = cloneConfig(session.config);
    prepareAudio();
    startTraining();
  });
}

function resultStats(session: StoredSession): string {
  const summary = session.summary;
  if (summary.scored && summary.scored > 0) {
    const accuracy = Math.round((summary.accuracy ?? 0) * 100);
    return [
      statCard('Rondas', `${summary.completed} / ${summary.planned}`, exerciseMeta[session.exercise].symbol),
      statCard('Aciertos', `${summary.correct ?? 0} / ${summary.scored}`, '✓'),
      statCard('Precisión', `${accuracy}%`, '◎'),
      statCard('Respuesta media', formatMilliseconds(summary.averageResponseMs ?? 0), '◷'),
    ].join('');
  }
  return [
    statCard('Estímulos', `${summary.completed} / ${summary.planned}`, exerciseMeta[session.exercise].symbol),
    statCard('Duración', formatDuration(summary.durationMs), '◷'),
    statCard('Señal visible', formatSeconds(summary.stimulusDurationMs), 'ϟ'),
    statCard(resultDetailLabel(session.config), resultDetailValue(session.config), '✣'),
  ].join('');
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

function specificResultDetails(config: ExerciseConfig): string {
  if (isCognitiveExercise(config.kind)) return cognitiveResultDetails(config as CognitiveConfig);
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
  if (config.kind === 'words') return `<div><dt>Consignas</dt><dd>${config.words.join(', ')}</dd></div>`;
  return '';
}

async function renderHistory(): Promise<void> {
  const actions = {
    onBack: () => navigate('home'),
    onTrain: () => navigate('home'),
  };
  mountHistoryScreen(app, null, actions);

  const sessions = await listSessions();
  if (screen !== 'history') return;

  mountHistoryScreen(
    app,
    sessions.map((session) => ({
      exercise: session.exercise,
      finishedAt: session.finishedAt,
      completed: session.summary.completed,
      scored: session.summary.scored,
      accuracy: session.summary.accuracy,
      durationMs: session.summary.durationMs,
    })),
    actions,
  );
}

function renderSettings(): void {
  mountSettingsScreen(app, settings, getAppVersion(), {
    onBack: () => navigate('home'),
    onChange: (key, enabled) => {
      settings[key] = enabled;
      persistSettings();
      if (key === 'sound' && settings.sound) prepareAudio();
    },
    onExportBackup: () => { void exportBackup(); },
    onImportBackup: requestBackupImport,
    onClearHistory: () => {
      openConfirmModal(
        'Borrar historial',
        'Se eliminarán todas las sesiones guardadas en este dispositivo.',
        'Borrar historial',
        async () => { await clearSessions(); },
      );
    },
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
  return getNativeAppVersion() ?? '0.1.0';
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
      if (!nativeVibrate(35) && navigator.vibrate) navigator.vibrate(35);
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

function formatMilliseconds(milliseconds: number): string {
  if (milliseconds < 1000) return `${Math.round(milliseconds)} ms`;
  return `${(milliseconds / 1000).toFixed(2).replace('.', ',')} s`;
}

function formatWait(minimumMs: number, maximumMs: number): string {
  if (Math.abs(maximumMs - minimumMs) < 1) return formatSeconds(minimumMs);
  return `${formatSeconds(minimumMs)} – ${formatSeconds(maximumMs)}`;
}

function createId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function exerciseIds(): ExerciseId[] {
  return [...EXERCISE_IDS];
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

async function saveSession(session: StoredSession): Promise<void> {
  try {
    await dbPutRecord(SESSION_STORE, session);
  } catch (error) {
    console.error('No se pudo guardar la sesión', error);
  }
}

async function listSessions(): Promise<StoredSession[]> {
  try {
    const values = await dbListRecords<StoredSession>(SESSION_STORE);
    return values.sort((a, b) => b.finishedAt.localeCompare(a.finishedAt));
  } catch (error) {
    console.error('No se pudo leer el historial', error);
    return [];
  }
}

async function clearSessions(): Promise<void> {
  try {
    await dbClearStore(SESSION_STORE);
  } catch (error) {
    console.error('No se pudo borrar el historial', error);
  }
}


render();
