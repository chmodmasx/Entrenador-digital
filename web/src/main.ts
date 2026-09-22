import './styles.css';
import './passive.css';
import './sections.css';
import {
  cognitiveTrainingSubtitle,
  isCognitiveExercise,
  mountCognitiveGame,
  type CognitiveController,
} from './cognitive-games';
import {
  EXERCISE_META,
  type CognitiveExerciseId,
  type ExerciseId,
} from './domain/exercises';
import {
  DEFAULT_CONFIGS,
  cloneConfig,
  cloneConfigMap,
  setExerciseConfig,
  type CognitiveConfig,
  type ExerciseConfig,
} from './domain/config';
import { DEFAULT_APP_SETTINGS, type AppSettings } from './domain/settings';
import { getNativeAppVersion, nativeVibrate, requestNativeUpdateCheck, setNativeTrainingMode } from './platform/native-bridge';
import { exportBackup, requestBackupImport } from './backup';
import { profileEnhanceCurrentScreen } from './profiles';
import { mountHomeScreen } from './screens/home';
import { mountConfigScreen } from './screens/config';
import { mountSettingsScreen } from './screens/settings';
import { mountHistoryScreen } from './screens/history';
import { mountResultsScreen } from './screens/results';
import { createNonRepeatingStimulus, type Stimulus } from './training/passive-stimulus';
import type { StoredSession, TrialResult } from './domain/session';
import { clearSessions, listSessions, saveSession } from './storage/sessions';
import { formatDuration } from './utils/format';

type Screen = 'home' | 'config' | 'training' | 'results' | 'history' | 'settings';

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

const exerciseMeta = EXERCISE_META;

const SETTINGS_KEY = 'entrenador-digital-settings-v1';
const defaultSettings: AppSettings = { ...DEFAULT_APP_SETTINGS };

let settings = loadSettings();
let screen: Screen = 'home';
let selectedExercise: ExerciseId = 'arrows';
let configs = cloneConfigMap(DEFAULT_CONFIGS);
let runtime: RuntimeSession | null = null;
let cognitiveController: CognitiveController | null = null;
let lastSession: StoredSession | null = null;
let audioContext: AudioContext | null = null;

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
}

function renderHome(): void {
  mountHomeScreen(app, {
    onConfigure: (exercise) => {
      selectedExercise = exercise;
      navigate('config');
    },
    onHistory: () => navigate('history'),
    onSettings: () => navigate('settings'),
  });
}

function renderConfig(): void {
  mountConfigScreen(app, selectedExercise, configs[selectedExercise], {
    onBack: () => navigate('home'),
    onStart: (config) => {
      setExerciseConfig(configs, config);
      prepareAudio();
      startTraining();
    },
  });
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

  mountResultsScreen(app, lastSession, {
    onBack: () => navigate('home'),
    onRepeat: (session) => {
      selectedExercise = session.exercise;
      setExerciseConfig(configs, cloneConfig(session.config));
      prepareAudio();
      startTraining();
    },
  });
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
    onCheckUpdates: () => {
      if (!requestNativeUpdateCheck()) showToast('La búsqueda de actualizaciones solo está disponible en Android.');
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

function randomBetween(min: number, max: number): number {
  return Math.floor(min + Math.random() * (max - min));
}

function createId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
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


render();
