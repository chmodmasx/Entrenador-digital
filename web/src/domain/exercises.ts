export type PassiveExerciseId = 'arrows' | 'numbers' | 'colors' | 'color-number' | 'stroop' | 'words';
export type CognitiveExerciseId = 'flow' | 'memory-match' | 'memory-matrix' | 'spatial-match' | 'star-search' | 'rule-shift';
export type ExerciseId = PassiveExerciseId | CognitiveExerciseId;
export type ExerciseCategory = 'reaction' | 'cognitive';

export type DirectionId =
  | 'up'
  | 'up-right'
  | 'right'
  | 'down-right'
  | 'down'
  | 'down-left'
  | 'left'
  | 'up-left';

export type ColorId = 'blue' | 'red' | 'green' | 'yellow' | 'orange' | 'violet';
export type StroopInstruction = 'ink' | 'word';

export const DIRECTION_IDS: DirectionId[] = [
  'up', 'up-right', 'right', 'down-right', 'down', 'down-left', 'left', 'up-left',
];

export const COLOR_IDS: ColorId[] = ['blue', 'red', 'green', 'yellow', 'orange', 'violet'];

export const DIRECTION_META: Record<DirectionId, { symbol: string; label: string; rotation: number }> = {
  up: { symbol: '↑', label: 'Arriba', rotation: 0 },
  'up-right': { symbol: '↗', label: 'Arriba derecha', rotation: 45 },
  right: { symbol: '→', label: 'Derecha', rotation: 90 },
  'down-right': { symbol: '↘', label: 'Abajo derecha', rotation: 135 },
  down: { symbol: '↓', label: 'Abajo', rotation: 180 },
  'down-left': { symbol: '↙', label: 'Abajo izquierda', rotation: 225 },
  left: { symbol: '←', label: 'Izquierda', rotation: 270 },
  'up-left': { symbol: '↖', label: 'Arriba izquierda', rotation: 315 },
};

export const COLOR_META: Record<ColorId, { label: string; hex: string }> = {
  blue: { label: 'Azul', hex: '#019CE8' },
  red: { label: 'Rojo', hex: '#E44B4B' },
  green: { label: 'Verde', hex: '#22A86A' },
  yellow: { label: 'Amarillo', hex: '#F4C542' },
  orange: { label: 'Naranja', hex: '#F28A2E' },
  violet: { label: 'Violeta', hex: '#8A5CF6' },
};

export const DEFAULT_WORDS = ['ADELANTE', 'ATRÁS', 'IZQUIERDA', 'DERECHA', 'SALTO', 'GIRO'] as const;

export interface ExerciseMeta {
  title: string;
  subtitle: string;
  description: string;
  symbol: string;
  category: ExerciseCategory;
}

export const PASSIVE_EXERCISE_IDS: PassiveExerciseId[] = [
  'arrows', 'numbers', 'colors', 'color-number', 'stroop', 'words',
];

export const COGNITIVE_EXERCISE_IDS: CognitiveExerciseId[] = [
  'flow', 'memory-match', 'memory-matrix', 'spatial-match', 'star-search', 'rule-shift',
];

export const EXERCISE_IDS: ExerciseId[] = [...PASSIVE_EXERCISE_IDS, ...COGNITIVE_EXERCISE_IDS];

export const EXERCISE_META: Record<ExerciseId, ExerciseMeta> = {
  arrows: {
    title: 'Flechas',
    subtitle: 'Reacciona a la dirección',
    description: 'Señales en ocho direcciones para desplazamientos y cambios de orientación.',
    symbol: '↑',
    category: 'reaction',
  },
  numbers: {
    title: 'Números',
    subtitle: 'Reacciona a los números',
    description: 'Números grandes y aleatorios para asociar consignas físicas o técnicas.',
    symbol: '123',
    category: 'reaction',
  },
  colors: {
    title: 'Colores',
    subtitle: 'Reacciona al color',
    description: 'Estímulos cromáticos de alta visibilidad para consignas rápidas.',
    symbol: '●',
    category: 'reaction',
  },
  'color-number': {
    title: 'Color + número',
    subtitle: 'Combina estímulos',
    description: 'Un número y un color aparecen juntos para aumentar la carga de decisión.',
    symbol: '7',
    category: 'reaction',
  },
  stroop: {
    title: 'Color y palabra',
    subtitle: 'Evita la distracción',
    description: 'Palabras de colores con tinta coincidente o distinta para trabajo tipo Stroop.',
    symbol: 'Aa',
    category: 'reaction',
  },
  words: {
    title: 'Palabras',
    subtitle: 'Reacciona a las palabras',
    description: 'Consignas personalizadas que aparecen automáticamente durante la sesión.',
    symbol: 'ABC',
    category: 'reaction',
  },
  flow: {
    title: 'Ebb & Flow',
    subtitle: 'Cambiá entre punta y movimiento',
    description: 'Deslizá en la dirección correcta: verde sigue la punta; naranja sigue el movimiento.',
    symbol: '❧',
    category: 'cognitive',
  },
  'memory-match': {
    title: 'Memory Match',
    subtitle: 'Compará con lo que viste antes',
    description: 'Mirá cada carta y decidí si es igual a la que apareció algunos turnos atrás.',
    symbol: '◇',
    category: 'cognitive',
  },
  'memory-matrix': {
    title: 'Memory Matrix',
    subtitle: 'Memorizá posiciones',
    description: 'Memorizá las casillas iluminadas y marcá las mismas cuando se apaguen.',
    symbol: '▦',
    category: 'cognitive',
  },
  'spatial-match': {
    title: 'Spatial Speed Match',
    subtitle: 'Compará dos patrones',
    description: 'Decidí rápidamente si los dos patrones tienen los puntos en las mismas posiciones.',
    symbol: '⠿',
    category: 'cognitive',
  },
  'star-search': {
    title: 'Star Search',
    subtitle: 'Encontrá la figura sin pareja',
    description: 'Buscá la única figura que no tiene otra igual y tocala.',
    symbol: '✦',
    category: 'cognitive',
  },
  'rule-shift': {
    title: 'Disillusion',
    subtitle: 'Cambiá entre color y forma',
    description: 'Elegí la figura que coincida con el objetivo según la consigna: mismo color o misma forma.',
    symbol: '⬟',
    category: 'cognitive',
  },
};

export function isCognitiveExerciseId(value: string): value is CognitiveExerciseId {
  return COGNITIVE_EXERCISE_IDS.includes(value as CognitiveExerciseId);
}
