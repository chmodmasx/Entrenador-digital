import './cognitive-games.css';
import { renderStepper } from './components/stepper';
import {
  DEFAULT_CONFIGS,
  type BaseConfig as CognitiveBaseConfig,
  type CognitiveConfig,
  type FlowConfig,
  type MemoryMatchConfig,
  type MemoryMatrixConfig,
  type RuleShiftConfig,
  type SpatialMatchConfig,
  type StarSearchConfig,
} from './domain/config';
import {
  COGNITIVE_EXERCISE_IDS,
  EXERCISE_META,
  isCognitiveExerciseId,
  type CognitiveExerciseId,
} from './domain/exercises';

export type { CognitiveExerciseId } from './domain/exercises';

export type {
  CognitiveConfig,
  FlowConfig,
  MemoryMatchConfig,
  MemoryMatrixConfig,
  RuleShiftConfig,
  SpatialMatchConfig,
  StarSearchConfig,
} from './domain/config';

export interface CognitiveMeta {
  title: string;
  subtitle: string;
  description: string;
  symbol: string;
}

export interface CognitiveTrialOutcome {
  stimulus: string;
  startedAt: number;
  responseMs: number;
  correct?: boolean;
}

export interface CognitiveController {
  start: () => void;
  stop: () => void;
}

interface MountOptions {
  root: HTMLElement;
  exercise: CognitiveExerciseId;
  config: CognitiveConfig;
  onSignal: () => void;
  onTrial: (trial: CognitiveTrialOutcome) => void;
  onComplete: () => void;
}

const DIRECTIONS = ['up', 'right', 'down', 'left'] as const;
type CardinalDirection = typeof DIRECTIONS[number];

const DIRECTION_LABELS: Record<CardinalDirection, string> = {
  up: 'Arriba',
  right: 'Derecha',
  down: 'Abajo',
  left: 'Izquierda',
};

const FLOW_COLORS = {
  green: '#45B66E',
  orange: '#F5A623',
} as const;

const GAME_COLORS = ['#19A7CE', '#F1B632', '#EA5A5A', '#50B783', '#9365D8', '#ED7D31'];
const MEMORY_SYMBOLS = ['▲', '●', '■', '◆', '✦', '✚'];
const RULE_SHAPES = ['circle', 'triangle', 'square', 'diamond'] as const;
type RuleShape = typeof RULE_SHAPES[number];

export const COGNITIVE_IDS: CognitiveExerciseId[] = [...COGNITIVE_EXERCISE_IDS];

export const cognitiveMeta: Record<CognitiveExerciseId, CognitiveMeta> = {
  flow: EXERCISE_META.flow,
  'memory-match': EXERCISE_META['memory-match'],
  'memory-matrix': EXERCISE_META['memory-matrix'],
  'spatial-match': EXERCISE_META['spatial-match'],
  'star-search': EXERCISE_META['star-search'],
  'rule-shift': EXERCISE_META['rule-shift'],
};

export const cognitiveDefaults: Record<CognitiveExerciseId, CognitiveConfig> = {
  flow: DEFAULT_CONFIGS.flow,
  'memory-match': DEFAULT_CONFIGS['memory-match'],
  'memory-matrix': DEFAULT_CONFIGS['memory-matrix'],
  'spatial-match': DEFAULT_CONFIGS['spatial-match'],
  'star-search': DEFAULT_CONFIGS['star-search'],
  'rule-shift': DEFAULT_CONFIGS['rule-shift'],
};
export function isCognitiveExercise(value: string): value is CognitiveExerciseId {
  return isCognitiveExerciseId(value);
}

export function cognitiveCardVisual(id: CognitiveExerciseId): string {
  if (id === 'flow') {
    return `<svg class="cog-card-flow" viewBox="0 0 96 72" aria-hidden="true">
      <g class="flow-leaf flow-leaf-green" transform="translate(7 6) rotate(-24 28 17)">
        <path class="flow-leaf-shape" d="M2 25C11 4 34-3 54 5C52 25 35 40 12 38C6 36 3 31 2 25Z"/>
        <path class="flow-leaf-vein" d="M10 31C23 23 34 16 47 9"/>
      </g>
      <g class="flow-leaf flow-leaf-orange" transform="translate(37 30) rotate(-18 27 16)">
        <path class="flow-leaf-shape" d="M2 24C10 5 31-2 52 5C50 23 33 37 11 36C6 34 3 30 2 24Z"/>
        <path class="flow-leaf-vein" d="M10 29C22 22 33 15 45 9"/>
      </g>
    </svg>`;
  }
  if (id === 'memory-match') {
    return '<span class="cog-card-memory"><i>▲</i><i>▲</i></span>';
  }
  if (id === 'memory-matrix') {
    return '<span class="cog-card-matrix">' +
      Array.from({ length: 9 }, (_, index) => `<i class="${[0, 2, 4, 7].includes(index) ? 'on' : ''}"></i>`).join('') +
      '</span>';
  }
  if (id === 'spatial-match') {
    return '<span class="cog-card-spatial"><i><b></b><b></b><b></b></i><i><b></b><b></b><b></b></i></span>';
  }
  if (id === 'star-search') {
    return '<span class="cog-card-star"><i>◆</i><i>◆</i><i>●</i><i>●</i><i>✦</i></span>';
  }
  return '<span class="cog-card-rule"><i>○</i><i>◆</i><i>+</i></span>';
}

export function cognitiveTrainingNote(id: CognitiveExerciseId): string {
  if (id === 'flow') {
    return '<div class="training-mode-note cognitive-mode-note"><span>i</span><div><strong>Control por gestos</strong>Deslizá arriba, abajo, izquierda o derecha para responder. No hace falta tocar ningún botón.</div></div>';
  }
  if (id === 'memory-matrix') {
    return '<div class="training-mode-note cognitive-mode-note"><span>i</span><div><strong>Cómo jugar</strong>Memorizá las casillas iluminadas. Cuando se apaguen, marcá las mismas.</div></div>';
  }
  if (id === 'star-search') {
    return '<div class="training-mode-note cognitive-mode-note"><span>i</span><div><strong>Cómo jugar</strong>Encontrá la única figura sin pareja y tocala.</div></div>';
  }
  if (id === 'memory-match') {
    return '<div class="training-mode-note cognitive-mode-note"><span>i</span><div><strong>Cómo jugar</strong>Compará cada carta con la que apareció algunos turnos atrás y respondé SÍ o NO.</div></div>';
  }
  if (id === 'spatial-match') {
    return '<div class="training-mode-note cognitive-mode-note"><span>i</span><div><strong>Cómo jugar</strong>Compará los dos patrones y elegí IGUAL o DIFERENTE.</div></div>';
  }
  if (id === 'rule-shift') {
    return '<div class="training-mode-note cognitive-mode-note"><span>i</span><div><strong>Cómo jugar</strong>Elegí la figura con el mismo color o la misma forma, según indique la consigna.</div></div>';
  }
  return '<div class="training-mode-note cognitive-mode-note"><span>i</span><div><strong>Cómo jugar</strong>Respondé antes de que termine el tiempo de cada ronda.</div></div>';
}

export function cognitiveTrainingSubtitle(id: CognitiveExerciseId, config: CognitiveConfig): string {
  if (id === 'memory-match' && config.kind === 'memory-match') return `Compará con ${turnsBackLabel(config.nBack)} atrás`;
  if (id === 'memory-matrix' && config.kind === 'memory-matrix') return `${config.gridSize}×${config.gridSize} · recordá ${config.memoryCells} casillas`;
  if (id === 'flow') return 'Verde: seguí la punta · Naranja: seguí el movimiento';
  if (id === 'spatial-match') return '¿Los dos patrones son iguales?';
  if (id === 'star-search') return 'Encontrá la figura sin pareja';
  if (id === 'rule-shift') return 'La consigna cambia entre color y forma';
  return 'Juego cognitivo en curso';
}

const stepper = renderStepper;

export function cognitiveConfigSection(config: CognitiveConfig): string {
  if (config.kind === 'flow') {
    return `
      <section class="settings-card cognitive-rules-card">
        <div class="section-title"><span>❧</span><div><h2>Cómo responder</h2><p>El color indica qué dirección seguir</p></div></div>
        <div class="cognitive-rule-preview">
          <div><span class="rule-leaf rule-leaf-green"></span><strong>Verde</strong><small>Seguí la punta de la hoja</small></div>
          <div><span class="rule-leaf rule-leaf-orange"></span><strong>Naranja</strong><small>Seguí el movimiento</small></div>
        </div>
      </section>`;
  }

  if (config.kind === 'memory-match') {
    return `
      <section class="settings-card">
        <div class="section-title"><span>◇</span><div><h2>Memoria</h2><p>Elegí cuántos turnos atrás comparar</p></div></div>
        ${stepper('nBack', 'Comparar con', config.nBack, 'turnos atrás', 1, 3, 1)}
      </section>`;
  }

  if (config.kind === 'memory-matrix') {
    return `
      <section class="settings-card">
        <div class="section-title"><span>▦</span><div><h2>Matriz</h2><p>Elegí el tamaño y cuántas casillas memorizar</p></div></div>
        ${stepper('gridSize', 'Tamaño de matriz', config.gridSize, '×', 3, 6, 1)}
        ${stepper('memoryCells', 'Casillas a recordar', config.memoryCells, '', 2, 12, 1)}
      </section>`;
  }

  if (config.kind === 'spatial-match') {
    return `
      <section class="settings-card">
        <div class="section-title"><span>⠿</span><div><h2>Patrón</h2><p>Más puntos hacen más difícil comparar</p></div></div>
        ${stepper('itemCount', 'Puntos por patrón', config.itemCount, '', 3, 6, 1)}
      </section>`;
  }

  if (config.kind === 'star-search') {
    return `
      <section class="settings-card">
        <div class="section-title"><span>✦</span><div><h2>Búsqueda</h2><p>Más parejas hacen más difícil encontrar la figura única</p></div></div>
        ${stepper('pairCount', 'Parejas en pantalla', config.pairCount, '', 3, 7, 1)}
      </section>`;
  }

  return `
    <section class="settings-card">
      <div class="section-title"><span>⬟</span><div><h2>Opciones</h2><p>Elegí cuántas respuestas posibles aparecen</p></div></div>
      ${stepper('optionCount', 'Cantidad de opciones', config.optionCount, '', 3, 4, 1)}
    </section>`;
}

function readNumber(form: HTMLFormElement, id: string): number {
  return Number(form.querySelector<HTMLInputElement>(`#${id}`)?.value ?? Number.NaN);
}

export function readCognitiveConfig(
  kind: CognitiveExerciseId,
  form: HTMLFormElement,
  base: CognitiveBaseConfig,
): { config?: CognitiveConfig; error?: string } {
  if (kind === 'flow') return { config: { kind, ...base } };

  if (kind === 'memory-match') {
    const nBack = Math.round(readNumber(form, 'nBack'));
    if (!Number.isFinite(nBack) || nBack < 1 || nBack > 3) return { error: 'El nivel N-back debe estar entre 1 y 3.' };
    return { config: { kind, ...base, nBack } };
  }

  if (kind === 'memory-matrix') {
    const gridSize = Math.round(readNumber(form, 'gridSize'));
    const memoryCells = Math.round(readNumber(form, 'memoryCells'));
    if (!Number.isFinite(gridSize) || gridSize < 3 || gridSize > 6) return { error: 'La matriz debe estar entre 3×3 y 6×6.' };
    if (!Number.isFinite(memoryCells) || memoryCells < 2 || memoryCells >= gridSize * gridSize) {
      return { error: 'La cantidad de casillas debe ser menor al total de la matriz.' };
    }
    return { config: { kind, ...base, gridSize, memoryCells } };
  }

  if (kind === 'spatial-match') {
    const itemCount = Math.round(readNumber(form, 'itemCount'));
    if (!Number.isFinite(itemCount) || itemCount < 3 || itemCount > 6) return { error: 'Usa entre 3 y 6 puntos por patrón.' };
    return { config: { kind, ...base, itemCount } };
  }

  if (kind === 'star-search') {
    const pairCount = Math.round(readNumber(form, 'pairCount'));
    if (!Number.isFinite(pairCount) || pairCount < 3 || pairCount > 7) return { error: 'Usa entre 3 y 7 parejas.' };
    return { config: { kind, ...base, pairCount } };
  }

  const optionCount = Math.round(readNumber(form, 'optionCount'));
  if (!Number.isFinite(optionCount) || optionCount < 3 || optionCount > 4) return { error: 'Usa 3 o 4 opciones de respuesta.' };
  return { config: { kind, ...base, optionCount } };
}

export function cognitivePresetSummary(config: CognitiveConfig): string {
  const pause = formatPause(config.waitMinMs, config.waitMaxMs);
  if (config.kind === 'flow') return `Punta / movimiento · ${pause}`;
  if (config.kind === 'memory-match') return `${turnsBackLabel(config.nBack)} atrás · ${pause}`;
  if (config.kind === 'memory-matrix') return `${config.gridSize}×${config.gridSize} · ${config.memoryCells} casillas · ${formatSeconds(config.stimulusDurationMs)} para memorizar · ${pause}`;
  if (config.kind === 'spatial-match') return `${config.itemCount} puntos · ${pause}`;
  if (config.kind === 'star-search') return `${config.pairCount} parejas + 1 sin pareja · ${pause}`;
  return `${config.optionCount} opciones · color / forma · ${pause}`;
}

export function cognitiveResultDetailLabel(config: CognitiveConfig): string {
  if (config.kind === 'memory-match') return 'Nivel';
  if (config.kind === 'memory-matrix') return 'Matriz';
  if (config.kind === 'spatial-match') return 'Puntos';
  if (config.kind === 'star-search') return 'Parejas';
  if (config.kind === 'rule-shift') return 'Opciones';
  return 'Reglas';
}

export function cognitiveResultDetailValue(config: CognitiveConfig): string {
  if (config.kind === 'memory-match') return `${config.nBack}-back`;
  if (config.kind === 'memory-matrix') return `${config.gridSize}×${config.gridSize}`;
  if (config.kind === 'spatial-match') return String(config.itemCount);
  if (config.kind === 'star-search') return String(config.pairCount);
  if (config.kind === 'rule-shift') return String(config.optionCount);
  return '2';
}

export function cognitiveResultDetails(config: CognitiveConfig): string {
  if (config.kind === 'flow') {
    return '<div><dt>Verde</dt><dd>Seguir la punta</dd></div><div><dt>Naranja</dt><dd>Seguir el movimiento</dd></div>';
  }
  if (config.kind === 'memory-match') return `<div><dt>Distancia de memoria</dt><dd>${config.nBack}-back</dd></div>`;
  if (config.kind === 'memory-matrix') {
    return `<div><dt>Tamaño</dt><dd>${config.gridSize}×${config.gridSize}</dd></div><div><dt>Casillas por ronda</dt><dd>${config.memoryCells}</dd></div><div><dt>Tiempo de memorización</dt><dd>${formatSeconds(config.stimulusDurationMs)}</dd></div>`;
  }
  if (config.kind === 'spatial-match') return `<div><dt>Puntos por patrón</dt><dd>${config.itemCount}</dd></div>`;
  if (config.kind === 'star-search') return `<div><dt>Parejas por ronda</dt><dd>${config.pairCount}</dd></div>`;
  return `<div><dt>Opciones por ronda</dt><dd>${config.optionCount}</dd></div><div><dt>Reglas</dt><dd>Color y forma</dd></div>`;
}

export function mountCognitiveGame(options: MountOptions): CognitiveController {
  const { root, exercise, config, onSignal, onTrial, onComplete } = options;
  let active = false;
  let stopped = false;
  let round = 0;
  let timer: number | undefined;
  let roundStartedAt = 0;
  let stopFlowAnimation: (() => void) | undefined;
  const memorySequence: Array<{ symbol: string; color: string; key: string }> = [];

  const stopFlowMotion = () => {
    stopFlowAnimation?.();
    stopFlowAnimation = undefined;
  };

  const clearTimer = () => {
    if (timer !== undefined) window.clearTimeout(timer);
    timer = undefined;
  };

  const finish = () => {
    if (stopped) return;
    clearTimer();
    stopFlowMotion();
    active = false;
    onComplete();
  };

  const scheduleNext = (extraDelay = 0) => {
    if (stopped) return;
    clearTimer();
    if (round >= config.repetitions) {
      timer = window.setTimeout(finish, Math.max(180, extraDelay));
      return;
    }
    const delay = extraDelay + randomBetween(config.waitMinMs, config.waitMaxMs);
    timer = window.setTimeout(beginRound, delay);
  };

  const feedbackThenNext = (correct: boolean, message?: string) => {
    root.classList.remove('answer-correct', 'answer-wrong', 'answer-timeout');
    root.classList.add(correct ? 'answer-correct' : 'answer-wrong');
    const feedback = root.querySelector<HTMLElement>('[data-feedback]');
    if (feedback) feedback.textContent = message ?? (correct ? 'Correcto' : 'Incorrecto');
    scheduleNext(280);
  };

  const record = (stimulus: string, correct: boolean | undefined, responseMs: number) => {
    onTrial({
      stimulus,
      startedAt: roundStartedAt,
      responseMs: Math.max(0, responseMs),
      correct,
    });
    round += 1;
  };

  const timeoutRound = (stimulus: string) => {
    if (!active || stopped) return;
    active = false;
    record(stimulus, false, performance.now() - roundStartedAt);
    root.classList.add('answer-timeout');
    const feedback = root.querySelector<HTMLElement>('[data-feedback]');
    if (feedback) feedback.textContent = 'Tiempo';
    scheduleNext(360);
  };

  const armTimeout = (stimulus: string, duration = config.stimulusDurationMs) => {
    clearTimer();
    timer = window.setTimeout(() => timeoutRound(stimulus), Math.max(500, duration));
  };

  const answer = (stimulus: string, correct: boolean) => {
    if (!active || stopped) return;
    active = false;
    clearTimer();
    const responseMs = performance.now() - roundStartedAt;
    record(stimulus, correct, responseMs);
    feedbackThenNext(correct);
  };

  const beginFlow = () => {
    const leafColor = Math.random() < 0.5 ? 'green' : 'orange';
    const orientation = randomItem(DIRECTIONS);
    let movement = randomItem(DIRECTIONS);
    if (Math.random() < 0.75) {
      while (movement === orientation) movement = randomItem(DIRECTIONS);
    }
    const expected = leafColor === 'green' ? orientation : movement;
    const stimulus = `${leafColor === 'green' ? 'Verde' : 'Naranja'} · apunta ${DIRECTION_LABELS[orientation]} · mueve ${DIRECTION_LABELS[movement]}`;

    stopFlowMotion();
    const leafMarkup = createFlowLeafLayout().map((leaf) => `
      <div class="flow-leaf-item"
           data-flow-leaf
           data-flow-x="${leaf.x}"
           data-flow-y="${leaf.y}"
           data-flow-scale="${leaf.scale}"
           style="--leaf-scale:${leaf.scale};--leaf-delay:${leaf.delayMs}ms">
        ${leafSvg(orientation, FLOW_COLORS[leafColor])}
      </div>`
    ).join('');

    root.innerHTML = `
      <div class="cognitive-game flow-game" data-flow-swipe aria-label="Deslizá en la dirección correcta">
        <div class="flow-rule-bar"><span><i class="flow-rule-dot green"></i>VERDE = punta</span><span><i class="flow-rule-dot orange"></i>NARANJA = movimiento</span></div>
        <div class="flow-field">
          <div class="flow-swarm">${leafMarkup}</div>
        </div>
        <div class="cognitive-feedback" data-feedback></div>
        <div class="flow-swipe-hint" aria-hidden="true"><span>↕</span><strong>DESLIZÁ PARA RESPONDER</strong><span>↔</span></div>
      </div>`;

    const field = root.querySelector<HTMLElement>('.flow-field');
    if (field) stopFlowAnimation = startFlowMotion(field, movement);

    const swipeSurface = root.querySelector<HTMLElement>('[data-flow-swipe]');
    if (swipeSurface) {
      bindDirectionalSwipe(swipeSurface, (direction) => answer(stimulus, direction === expected));
    }
    armTimeout(stimulus);
  };

  const beginMemoryMatch = () => {
    const memoryConfig = config as MemoryMatchConfig;
    let token = makeMemoryToken();
    if (round >= memoryConfig.nBack && Math.random() < 0.48) {
      token = { ...memorySequence[round - memoryConfig.nBack] };
    } else if (round >= memoryConfig.nBack) {
      const targetKey = memorySequence[round - memoryConfig.nBack]?.key;
      let attempts = 0;
      while (token.key === targetKey && attempts < 8) {
        token = makeMemoryToken();
        attempts += 1;
      }
    }
    memorySequence.push(token);

    const primer = round < memoryConfig.nBack;
    const matches = !primer && token.key === memorySequence[round - memoryConfig.nBack]?.key;
    const stimulus = `${token.symbol} ${token.color} · ${memoryConfig.nBack}-back`;

    root.innerHTML = `
      <div class="cognitive-game memory-match-game">
        <div class="memory-instruction">${primer ? 'Recordá esta carta' : `¿Es igual a la de ${turnsBackLabel(memoryConfig.nBack)} atrás?`}</div>
        <div class="memory-card" style="--memory-color:${token.color}"><span>${token.symbol}</span></div>
        <div class="cognitive-feedback" data-feedback></div>
        <div class="binary-actions ${primer ? 'is-primer' : ''}">
          <button type="button" data-answer="no" ${primer ? 'disabled' : ''}>NO</button>
          <button type="button" data-answer="yes" ${primer ? 'disabled' : ''}>SÍ</button>
        </div>
      </div>`;

    if (primer) {
      clearTimer();
      timer = window.setTimeout(() => {
        if (stopped) return;
        active = false;
        record(stimulus, undefined, Math.min(memoryConfig.stimulusDurationMs, 1200));
        scheduleNext(80);
      }, Math.min(Math.max(700, memoryConfig.stimulusDurationMs * 0.5), 1300));
      return;
    }

    root.querySelectorAll<HTMLButtonElement>('[data-answer]').forEach((button) => {
      button.addEventListener('click', () => {
        const saysMatch = button.dataset.answer === 'yes';
        answer(stimulus, saysMatch === matches);
      }, { once: true });
    });
    armTimeout(stimulus);
  };

  const beginMemoryMatrix = () => {
    const matrixConfig = config as MemoryMatrixConfig;
    const total = matrixConfig.gridSize * matrixConfig.gridSize;
    const targets = shuffle(Array.from({ length: total }, (_, index) => index)).slice(0, matrixConfig.memoryCells);
    const targetSet = new Set(targets);
    const stimulus = `${matrixConfig.memoryCells} casillas en matriz ${matrixConfig.gridSize}×${matrixConfig.gridSize}`;
    const gridHtml = Array.from({ length: total }, (_, index) =>
      `<button type="button" class="matrix-cell is-lit" data-cell="${index}" aria-label="Casilla ${index + 1}"></button>`
    ).join('');

    root.innerHTML = `
      <div class="cognitive-game matrix-game">
        <div class="matrix-instruction" data-matrix-instruction>Memorizá las casillas iluminadas</div>
        <div class="memory-grid" data-memory-grid style="--grid-size:${matrixConfig.gridSize}">
          ${gridHtml}
        </div>
        <div class="cognitive-feedback" data-feedback></div>
        <button type="button" class="matrix-confirm" data-matrix-confirm disabled>Confirmar</button>
      </div>`;

    root.querySelectorAll<HTMLButtonElement>('[data-cell]').forEach((cell) => {
      if (!targetSet.has(Number(cell.dataset.cell))) cell.classList.remove('is-lit');
      cell.disabled = true;
    });

    clearTimer();
    timer = window.setTimeout(() => {
      if (stopped) return;
      const selectionStartedAt = performance.now();
      const instruction = root.querySelector<HTMLElement>('[data-matrix-instruction]');
      if (instruction) instruction.textContent = `Marcá ${matrixConfig.memoryCells} casillas`;
      const selected = new Set<number>();
      const confirm = root.querySelector<HTMLButtonElement>('[data-matrix-confirm]');

      root.querySelectorAll<HTMLButtonElement>('[data-cell]').forEach((cell) => {
        cell.classList.remove('is-lit');
        cell.disabled = false;
        cell.addEventListener('click', () => {
          const index = Number(cell.dataset.cell);
          if (selected.has(index)) {
            selected.delete(index);
            cell.classList.remove('is-selected');
          } else if (selected.size < matrixConfig.memoryCells) {
            selected.add(index);
            cell.classList.add('is-selected');
          }
          if (confirm) confirm.disabled = selected.size !== matrixConfig.memoryCells;
        });
      });

      confirm?.addEventListener('click', () => {
        if (!active || selected.size !== matrixConfig.memoryCells) return;
        active = false;
        const correct = targets.every((target) => selected.has(target));
        record(stimulus, correct, performance.now() - selectionStartedAt);
        root.querySelectorAll<HTMLButtonElement>('[data-cell]').forEach((cell) => {
          cell.disabled = true;
          const index = Number(cell.dataset.cell);
          if (targetSet.has(index)) cell.classList.add('is-solution');
          if (selected.has(index) && !targetSet.has(index)) cell.classList.add('is-wrong-choice');
        });
        feedbackThenNext(correct);
      }, { once: true });
    }, Math.max(450, matrixConfig.stimulusDurationMs));
  };

  const beginSpatialMatch = () => {
    const spatialConfig = config as SpatialMatchConfig;
    const first = randomPositions(spatialConfig.itemCount, 16);
    const same = Math.random() < 0.5;
    const second = same ? [...first] : mutatePositions(first, 16);
    const stimulus = `Patrones ${same ? 'iguales' : 'diferentes'} con ${spatialConfig.itemCount} puntos`;

    root.innerHTML = `
      <div class="cognitive-game spatial-game">
        <div class="spatial-instruction">¿Los dos patrones son iguales?</div>
        <div class="spatial-pair">
          ${spatialGrid(first)}
          ${spatialGrid(second)}
        </div>
        <div class="cognitive-feedback" data-feedback></div>
        <div class="binary-actions">
          <button type="button" data-answer="different">DIFERENTE</button>
          <button type="button" data-answer="same">IGUAL</button>
        </div>
      </div>`;

    root.querySelectorAll<HTMLButtonElement>('[data-answer]').forEach((button) => {
      button.addEventListener('click', () => answer(stimulus, (button.dataset.answer === 'same') === same), { once: true });
    });
    armTimeout(stimulus);
  };

  const beginStarSearch = () => {
    const starConfig = config as StarSearchConfig;
    const descriptors = uniqueDescriptors(starConfig.pairCount + 1);
    const paired: StarDescriptor[] = [];
    descriptors.slice(0, starConfig.pairCount).forEach((descriptor) => {
      paired.push(descriptor, { ...descriptor });
    });
    const odd = descriptors[starConfig.pairCount];
    const items = shuffle([...paired, odd]);
    const oddKey = descriptorKey(odd);
    const stimulus = `${starConfig.pairCount} parejas y una figura única`;

    root.innerHTML = `
      <div class="cognitive-game star-game">
        <div class="star-instruction">Tocá la figura sin pareja</div>
        <div class="star-board">
          ${items.map((item, index) => `
            <button type="button" class="star-item" data-star-index="${index}" data-key="${descriptorKey(item)}" aria-label="Figura ${index + 1}">
              <span style="--star-color:${item.color}">${item.symbol}</span>
            </button>`).join('')}
        </div>
        <div class="cognitive-feedback" data-feedback></div>
      </div>`;

    root.querySelectorAll<HTMLButtonElement>('[data-star-index]').forEach((button) => {
      button.addEventListener('click', () => answer(stimulus, button.dataset.key === oddKey), { once: true });
    });
    armTimeout(stimulus);
  };

  const beginRuleShift = () => {
    const ruleConfig = config as RuleShiftConfig;
    const rule = Math.random() < 0.5 ? 'color' : 'shape';
    const target = makeRuleDescriptor();
    const options = makeRuleOptions(target, rule, ruleConfig.optionCount);
    const correctIndex = options.findIndex((item) => rule === 'color' ? item.color === target.color : item.shape === target.shape);
    const stimulus = `Regla ${rule === 'color' ? 'COLOR' : 'FORMA'} · objetivo ${target.shape}`;

    root.innerHTML = `
      <div class="cognitive-game rule-game">
        <div class="rule-target-wrap">${rulePiece(target, 'rule-target')}</div>
        <div class="rule-instruction" aria-label="Regla activa: ${rule === 'color' ? 'color' : 'forma'}">${rule === 'color' ? 'COLOR' : 'FORMA'}</div>
        <div class="rule-options">
          ${options.map((item, index) => `<button type="button" data-rule-index="${index}">${rulePiece(item, '')}</button>`).join('')}
        </div>
        <div class="cognitive-feedback" data-feedback></div>
      </div>`;

    root.querySelectorAll<HTMLButtonElement>('[data-rule-index]').forEach((button) => {
      button.addEventListener('click', () => answer(stimulus, Number(button.dataset.ruleIndex) === correctIndex), { once: true });
    });
    armTimeout(stimulus);
  };

  const beginRound = () => {
    if (stopped || round >= config.repetitions) {
      finish();
      return;
    }
    clearTimer();
    root.classList.remove('answer-correct', 'answer-wrong', 'answer-timeout');
    active = true;
    roundStartedAt = performance.now();
    onSignal();

    if (exercise === 'flow') beginFlow();
    else if (exercise === 'memory-match') beginMemoryMatch();
    else if (exercise === 'memory-matrix') beginMemoryMatrix();
    else if (exercise === 'spatial-match') beginSpatialMatch();
    else if (exercise === 'star-search') beginStarSearch();
    else beginRuleShift();
  };

  root.innerHTML = '<div class="cognitive-ready"><span>✦</span><strong>Preparado</strong><small>El juego comenzará después de la cuenta regresiva.</small></div>';

  return {
    start: () => {
      if (stopped || active || round > 0) return;
      scheduleNext(0);
    },
    stop: () => {
      stopped = true;
      active = false;
      clearTimer();
      stopFlowMotion();
      root.innerHTML = '';
    },
  };
}

function bindDirectionalSwipe(
  element: HTMLElement,
  onSwipe: (direction: CardinalDirection) => void,
): void {
  const minimumDistance = 34;
  let tracking = false;
  let startX = 0;
  let startY = 0;
  let pointerId = -1;

  element.addEventListener('pointerdown', (event) => {
    if (!event.isPrimary) return;
    tracking = true;
    pointerId = event.pointerId;
    startX = event.clientX;
    startY = event.clientY;
    element.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  });

  element.addEventListener('pointerup', (event) => {
    if (!tracking || event.pointerId !== pointerId) return;
    tracking = false;

    const deltaX = event.clientX - startX;
    const deltaY = event.clientY - startY;
    if (Math.hypot(deltaX, deltaY) < minimumDistance) return;

    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      onSwipe(deltaX > 0 ? 'right' : 'left');
    } else {
      onSwipe(deltaY > 0 ? 'down' : 'up');
    }
  });

  element.addEventListener('pointercancel', () => {
    tracking = false;
    pointerId = -1;
  });
}

interface FlowLeafPlacement {
  x: number;
  y: number;
  scale: number;
  delayMs: number;
}

const FLOW_SPEED_PX_PER_SECOND = 96;
const FLOW_COLUMNS = 3;
const FLOW_ROWS = 4;

function createFlowLeafLayout(): FlowLeafPlacement[] {
  const columnStep = 100 / FLOW_COLUMNS;
  const rowStep = 100 / FLOW_ROWS;
  const phaseX = randomBetweenFloat(0, columnStep);
  const phaseY = randomBetweenFloat(0, rowStep);
  const leaves: FlowLeafPlacement[] = [];

  for (let row = 0; row < FLOW_ROWS; row += 1) {
    const stagger = row % 2 === 0 ? 0 : columnStep / 2;
    for (let column = 0; column < FLOW_COLUMNS; column += 1) {
      leaves.push({
        x: wrapFlowCoordinate(
          phaseX + stagger + column * columnStep + randomBetweenFloat(-1.6, 1.6),
          100,
        ),
        y: wrapFlowCoordinate(
          phaseY + row * rowStep + randomBetweenFloat(-1.2, 1.2),
          100,
        ),
        scale: randomBetweenFloat(0.94, 1.06),
        delayMs: randomInteger(0, 45),
      });
    }
  }

  return leaves;
}

function startFlowMotion(field: HTMLElement, movement: CardinalDirection): () => void {
  const items = Array.from(field.querySelectorAll<HTMLElement>('[data-flow-leaf]')).map((element) => ({
    element,
    x: Number(element.dataset.flowX ?? 0),
    y: Number(element.dataset.flowY ?? 0),
    scale: Number(element.dataset.flowScale ?? 1),
  }));

  let animationFrame = 0;
  let startedAt = 0;
  let stopped = false;

  const animate = (now: number) => {
    if (stopped) return;
    if (startedAt === 0) startedAt = now;

    const width = field.clientWidth;
    const height = field.clientHeight;
    if (width > 0 && height > 0) {
      const distance = ((now - startedAt) / 1000) * FLOW_SPEED_PX_PER_SECOND;
      const deltaX = movement === 'right' ? distance : movement === 'left' ? -distance : 0;
      const deltaY = movement === 'down' ? distance : movement === 'up' ? -distance : 0;

      items.forEach((leaf) => {
        const x = wrapFlowCoordinate((leaf.x / 100) * width + deltaX, width);
        const y = wrapFlowCoordinate((leaf.y / 100) * height + deltaY, height);
        leaf.element.style.transform =
          `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%) scale(${leaf.scale})`;
      });
    }

    animationFrame = window.requestAnimationFrame(animate);
  };

  animationFrame = window.requestAnimationFrame(animate);
  return () => {
    stopped = true;
    window.cancelAnimationFrame(animationFrame);
  };
}

function wrapFlowCoordinate(value: number, span: number): number {
  if (span <= 0) return 0;
  return ((value % span) + span) % span;
}

function leafSvg(direction: CardinalDirection, color: string): string {
  const rotation: Record<CardinalDirection, number> = { up: -90, right: 0, down: 90, left: 180 };
  return `
    <svg class="flow-leaf" viewBox="0 0 180 180" style="--leaf-color:${color};--leaf-rotation:${rotation[direction]}deg" aria-hidden="true">
      <g class="flow-leaf-rotator">
        <path d="M28 90C55 51 105 43 169 90C109 137 57 130 28 90Z"
              fill="var(--leaf-color)" stroke="rgba(255,255,255,.92)" stroke-width="3.4" stroke-linejoin="round"/>
        <path d="M28 90C73 86 119 87 158 90" fill="none" stroke="rgba(255,255,255,.82)" stroke-width="3.5" stroke-linecap="round"/>
        <path d="M66 87 86 68M94 87 116 67M66 94 87 110M99 93 121 108" fill="none" stroke="rgba(255,255,255,.25)" stroke-width="2.1" stroke-linecap="round"/>
        <path d="M28 90H10" fill="none" stroke="rgba(255,255,255,.92)" stroke-width="11" stroke-linecap="round"/>
        <path d="M28 90H10" fill="none" stroke="var(--leaf-color)" stroke-width="6.5" stroke-linecap="round"/>
      </g>
    </svg>`;
}

function makeMemoryToken(): { symbol: string; color: string; key: string } {
  const symbol = randomItem(MEMORY_SYMBOLS);
  const color = randomItem(GAME_COLORS);
  return { symbol, color, key: `${symbol}-${color}` };
}

function spatialGrid(positions: number[]): string {
  const active = new Set(positions);
  return `<div class="spatial-grid">${Array.from({ length: 16 }, (_, index) => `<i class="${active.has(index) ? 'on' : ''}"></i>`).join('')}</div>`;
}

function randomPositions(count: number, total: number): number[] {
  return shuffle(Array.from({ length: total }, (_, index) => index)).slice(0, count).sort((a, b) => a - b);
}

function mutatePositions(source: number[], total: number): number[] {
  const next = [...source];
  const used = new Set(next);
  const replaceIndex = randomInteger(0, next.length - 1);
  const candidates = Array.from({ length: total }, (_, index) => index).filter((index) => !used.has(index));
  next[replaceIndex] = randomItem(candidates);
  return next.sort((a, b) => a - b);
}

interface StarDescriptor {
  symbol: string;
  color: string;
}

function uniqueDescriptors(count: number): StarDescriptor[] {
  const pool: StarDescriptor[] = [];
  MEMORY_SYMBOLS.forEach((symbol) => GAME_COLORS.forEach((color) => pool.push({ symbol, color })));
  return shuffle(pool).slice(0, count);
}

function descriptorKey(item: StarDescriptor): string {
  return `${item.symbol}|${item.color}`;
}

interface RuleDescriptor {
  shape: RuleShape;
  color: string;
}

function makeRuleDescriptor(): RuleDescriptor {
  return { shape: randomItem(RULE_SHAPES), color: randomItem(GAME_COLORS.slice(1, 5)) };
}

function makeRuleOptions(target: RuleDescriptor, rule: 'color' | 'shape', count: number): RuleDescriptor[] {
  const options: RuleDescriptor[] = [];
  if (rule === 'color') {
    let shape = randomItem(RULE_SHAPES);
    while (shape === target.shape) shape = randomItem(RULE_SHAPES);
    options.push({ shape, color: target.color });
    while (options.length < count) {
      const candidate = makeRuleDescriptor();
      if (candidate.color === target.color) continue;
      if (options.some((item) => item.shape === candidate.shape && item.color === candidate.color)) continue;
      options.push(candidate);
    }
  } else {
    let color = randomItem(GAME_COLORS.slice(1, 5));
    while (color === target.color) color = randomItem(GAME_COLORS.slice(1, 5));
    options.push({ shape: target.shape, color });
    while (options.length < count) {
      const candidate = makeRuleDescriptor();
      if (candidate.shape === target.shape) continue;
      if (options.some((item) => item.shape === candidate.shape && item.color === candidate.color)) continue;
      options.push(candidate);
    }
  }
  return shuffle(options);
}

function rulePiece(item: RuleDescriptor, extraClass: string): string {
  return `<span class="rule-piece rule-shape-${item.shape} ${extraClass}" style="--piece-color:${item.color}" aria-label="${item.shape}"></span>`;
}

function randomItem<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)] as T;
}

function randomInteger(min: number, max: number): number {
  return Math.floor(min + Math.random() * (max - min + 1));
}

function randomBetween(min: number, max: number): number {
  if (max <= min) return min;
  return Math.floor(min + Math.random() * (max - min));
}

function randomBetweenFloat(min: number, max: number): number {
  if (max <= min) return min;
  return min + Math.random() * (max - min);
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInteger(0, index);
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function formatSeconds(milliseconds: number): string {
  const seconds = milliseconds / 1000;
  const value = Number.isInteger(seconds) ? seconds.toFixed(0) : seconds.toFixed(1).replace('.', ',');
  return `${value} s`;
}

function formatPause(minimumMs: number, maximumMs: number): string {
  if (Math.abs(maximumMs - minimumMs) < 1) return `${formatSeconds(minimumMs)} de pausa`;
  return `${formatSeconds(minimumMs)}–${formatSeconds(maximumMs)} entre rondas`;
}

function turnsBackLabel(turns: number): string {
  return turns === 1 ? '1 turno' : `${turns} turnos`;
}
