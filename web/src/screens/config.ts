import {
  cognitiveConfigSection,
  cognitiveTrainingNote,
  isCognitiveExercise,
  readCognitiveConfig,
} from '../cognitive-games';
import { bindSteppers, parseLocaleNumber, renderStepper } from '../components/stepper';
import type { BaseConfig, ExerciseConfig } from '../domain/config';
import {
  COLOR_IDS,
  COLOR_META,
  DIRECTION_IDS,
  DIRECTION_META,
  EXERCISE_META,
  type ColorId,
  type DirectionId,
  type ExerciseId,
  type StroopInstruction,
} from '../domain/exercises';
import { validateBaseTrainingValues } from '../domain/validation';
import { timingPolicy } from '../training-timing';

export interface ConfigScreenActions {
  onBack: () => void;
  onStart: (config: ExerciseConfig) => void;
}

const directionOrder: DirectionId[] = [...DIRECTION_IDS];
const colorOrder: ColorId[] = [...COLOR_IDS];

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  }[character] ?? character));
}

function toggleRow(id: string, title: string, description: string, checked: boolean): string {
  return `
    <label class="toggle-row" for="${id}">
      <span><strong>${title}</strong><small>${description}</small></span>
      <span class="toggle-control"><input id="${id}" type="checkbox" ${checked ? 'checked' : ''}><i></i></span>
    </label>`;
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
        ${renderStepper('waitMin', 'Espera mínima', config.waitMinMs / 1000, 's', policy.pauseMin, policy.pauseMax - 0.1, 0.1)}
        ${renderStepper('waitMax', 'Espera máxima', config.waitMaxMs / 1000, 's', policy.pauseMin + 0.1, policy.pauseMax, 0.1)}
      </section>`
    : `
      <section class="settings-card">
        <div class="section-title"><span>◴</span><div><h2>Pausa entre rondas</h2><p>Tiempo fijo antes de comenzar la siguiente ronda</p></div></div>
        ${renderStepper('roundPause', 'Duración de la pausa', pauseValue, 's', policy.pauseMin, policy.pauseMax, 0.1)}
      </section>`;

  return `
    <section class="settings-card">
      <div class="section-title"><span>◷</span><div><h2>Sesión</h2><p>Define cuántas ${countUnit} tendrá el entrenamiento</p></div></div>
      ${renderStepper('repetitions', cognitive ? 'Cantidad de rondas' : 'Cantidad de estímulos', config.repetitions, countUnit, 2, 200, 1)}
    </section>

    ${timingSection}

    <section class="settings-card">
      <div class="section-title"><span>ϟ</span><div><h2>${cognitive ? 'Ronda' : 'Estímulo'}</h2><p>${durationSubtitle}</p></div></div>
      ${renderStepper('stimulusDuration', durationLabel, config.stimulusDurationMs / 1000, 's', policy.durationMin, policy.durationMax, 0.1)}
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
            <span class="color-swatch" style="--swatch:${COLOR_META[color].hex}"></span>
            <span>${COLOR_META[color].label}</span>
            <span class="color-check">✓</span>
          </label>`).join('')}
      </div>
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
              <span class="direction-mini">${DIRECTION_META[direction].symbol}</span>
              <span>${DIRECTION_META[direction].label}</span>
            </label>`).join('')}
        </div>
      </section>`;
  }

  if (config.kind === 'numbers') {
    return `
      <section class="settings-card">
        <div class="section-title"><span>123</span><div><h2>Rango de números</h2><p>Define qué valores pueden aparecer</p></div></div>
        ${renderStepper('minNumber', 'Número mínimo', config.minNumber, '', 0, 99, 1)}
        ${renderStepper('maxNumber', 'Número máximo', config.maxNumber, '', 1, 999, 1)}
      </section>`;
  }

  if (config.kind === 'colors') {
    return colorSelectionSection(config.colors, 'Colores', 'Selecciona los colores que pueden aparecer');
  }

  if (config.kind === 'color-number') {
    return `
      <section class="settings-card">
        <div class="section-title"><span>123</span><div><h2>Rango de números</h2><p>Define qué valores pueden combinarse con un color</p></div></div>
        ${renderStepper('minNumber', 'Número mínimo', config.minNumber, '', 0, 99, 1)}
        ${renderStepper('maxNumber', 'Número máximo', config.maxNumber, '', 1, 999, 1)}
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

function numberInput(root: HTMLElement, id: string): number {
  const raw = root.querySelector<HTMLInputElement>(`#${id}`)?.value ?? '';
  return parseLocaleNumber(raw) ?? Number.NaN;
}

function showConfigError(root: HTMLElement, message: string): null {
  const error = root.querySelector<HTMLParagraphElement>('#form-error');
  if (error) {
    error.textContent = message;
    error.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  return null;
}

function readBaseConfig(root: HTMLElement, exercise: ExerciseId): BaseConfig | null {
  const roundPauseInput = root.querySelector<HTMLInputElement>('#roundPause');
  const waitMin = roundPauseInput ? numberInput(root, 'roundPause') : numberInput(root, 'waitMin');
  const waitMax = roundPauseInput ? waitMin : numberInput(root, 'waitMax');
  const validation = validateBaseTrainingValues(exercise, {
    repetitions: numberInput(root, 'repetitions'),
    waitMin,
    waitMax,
    stimulusDuration: numberInput(root, 'stimulusDuration'),
  });

  if (!validation.ok) return showConfigError(root, validation.error);
  return {
    repetitions: validation.value.repetitions,
    waitMinMs: Math.round(validation.value.waitMin * 1000),
    waitMaxMs: Math.round(validation.value.waitMax * 1000),
    stimulusDurationMs: Math.round(validation.value.stimulusDuration * 1000),
  };
}

function selectedColors(form: HTMLFormElement): ColorId[] {
  return Array.from(form.querySelectorAll<HTMLInputElement>('input[name="color"]:checked'))
    .map((element) => element.value as ColorId);
}

function uniqueWords(raw: string): string[] {
  const seen = new Set<string>();
  const words: string[] = [];
  raw.split(/\n|,/).forEach((entry) => {
    const word = entry.trim().replace(/\s+/g, ' ').toLocaleUpperCase('es');
    if (!word || seen.has(word)) return;
    seen.add(word);
    words.push(word);
  });
  return words.slice(0, 30);
}

function readAndValidateConfig(root: HTMLElement, form: HTMLFormElement, exercise: ExerciseId): ExerciseConfig | null {
  const error = root.querySelector<HTMLParagraphElement>('#form-error');
  if (error) error.textContent = '';
  const base = readBaseConfig(root, exercise);
  if (!base) return null;

  if (exercise === 'arrows') {
    const selected = Array.from(form.querySelectorAll<HTMLInputElement>('input[name="direction"]:checked'))
      .map((element) => element.value as DirectionId);
    if (selected.length < 2) return showConfigError(root, 'Selecciona al menos dos direcciones.');
    return { kind: 'arrows', ...base, directions: selected };
  }

  if (exercise === 'numbers') {
    const minNumber = Math.round(numberInput(root, 'minNumber'));
    const maxNumber = Math.round(numberInput(root, 'maxNumber'));
    if (maxNumber <= minNumber) return showConfigError(root, 'El número máximo debe ser mayor que el mínimo.');
    return { kind: 'numbers', ...base, minNumber, maxNumber };
  }

  if (exercise === 'colors') {
    const selected = selectedColors(form);
    if (selected.length < 2) return showConfigError(root, 'Selecciona al menos dos colores.');
    return { kind: 'colors', ...base, colors: selected };
  }

  if (exercise === 'color-number') {
    const minNumber = Math.round(numberInput(root, 'minNumber'));
    const maxNumber = Math.round(numberInput(root, 'maxNumber'));
    const selected = selectedColors(form);
    if (maxNumber <= minNumber) return showConfigError(root, 'El número máximo debe ser mayor que el mínimo.');
    if (selected.length < 2) return showConfigError(root, 'Selecciona al menos dos colores.');
    return { kind: 'color-number', ...base, minNumber, maxNumber, colors: selected };
  }

  if (exercise === 'stroop') {
    const selected = selectedColors(form);
    if (selected.length < 2) return showConfigError(root, 'Selecciona al menos dos colores para el ejercicio Stroop.');
    const instruction = (form.querySelector<HTMLInputElement>('input[name="stroopInstruction"]:checked')?.value ?? 'ink') as StroopInstruction;
    const allowMatches = form.querySelector<HTMLInputElement>('#allowMatches')?.checked ?? false;
    return { kind: 'stroop', ...base, colors: selected, instruction, allowMatches };
  }

  if (isCognitiveExercise(exercise)) {
    const result = readCognitiveConfig(exercise, form, base);
    if (!result.config) return showConfigError(root, result.error ?? 'Revisa la configuración del juego.');
    return result.config;
  }

  const rawWords = form.querySelector<HTMLTextAreaElement>('#wordList')?.value ?? '';
  const words = uniqueWords(rawWords);
  if (words.length < 2) return showConfigError(root, 'Escribe al menos dos palabras diferentes.');
  return { kind: 'words', ...base, words };
}

function bindEnhancements(root: HTMLElement): void {
  root.querySelectorAll<HTMLInputElement>('.check-option input, .color-option input').forEach((input) => {
    input.addEventListener('change', () => {
      input.closest('label')?.classList.toggle('is-selected', input.checked);
    });
    input.closest('label')?.classList.toggle('is-selected', input.checked);
  });
}

export function mountConfigScreen(
  root: HTMLElement,
  exercise: ExerciseId,
  config: ExerciseConfig,
  actions: ConfigScreenActions,
): void {
  const meta = EXERCISE_META[exercise];

  root.innerHTML = `
    <main class="app-shell config-screen" data-exercise-id="${exercise}">
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

  root.querySelector<HTMLButtonElement>('[data-action="back"]')?.addEventListener('click', actions.onBack);
  bindSteppers(root);
  bindEnhancements(root);

  const form = root.querySelector<HTMLFormElement>('#exercise-config');
  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    const next = readAndValidateConfig(root, form, exercise);
    if (next) actions.onStart(next);
  });
}
