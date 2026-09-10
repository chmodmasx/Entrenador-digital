export {};

type ExerciseId = 'arrows' | 'numbers' | 'colors' | 'color-number' | 'stroop' | 'words';
type DirectionId = 'up' | 'up-right' | 'right' | 'down-right' | 'down' | 'down-left' | 'left' | 'up-left';
type ColorId = 'blue' | 'red' | 'green' | 'yellow' | 'orange' | 'violet';
type StroopMode = 'ink' | 'word';

interface BaseSnapshot {
  repetitions: number;
  waitMin: number;
  waitMax: number;
  stimulusDuration: number;
}

interface ArrowsSnapshot extends BaseSnapshot {
  kind: 'arrows';
  directions: DirectionId[];
}

interface NumbersSnapshot extends BaseSnapshot {
  kind: 'numbers';
  minNumber: number;
  maxNumber: number;
}

interface ColorsSnapshot extends BaseSnapshot {
  kind: 'colors';
  colors: ColorId[];
}

interface ColorNumberSnapshot extends BaseSnapshot {
  kind: 'color-number';
  minNumber: number;
  maxNumber: number;
  colors: ColorId[];
}

interface StroopSnapshot extends BaseSnapshot {
  kind: 'stroop';
  colors: ColorId[];
  instruction: StroopMode;
  allowMatches: boolean;
}

interface WordsSnapshot extends BaseSnapshot {
  kind: 'words';
  words: string[];
}

type ExerciseSnapshot = ArrowsSnapshot | NumbersSnapshot | ColorsSnapshot | ColorNumberSnapshot | StroopSnapshot | WordsSnapshot;
type SnapshotMap = Record<ExerciseId, ExerciseSnapshot>;

interface TrainingProfile {
  schemaVersion: 1;
  id: string;
  name: string;
  configs: SnapshotMap;
  createdAt: string;
  updatedAt: string;
}

interface SessionRecord {
  id?: string;
  finishedAt?: string;
  profileId?: string;
  profileName?: string;
  [key: string]: unknown;
}

const STORAGE_KEY = 'entrenador-digital-profiles-v1';
const ACTIVE_KEY = 'entrenador-digital-active-profile-v1';
const PRESETS_CLEARED_KEY = 'entrenador-digital-old-presets-cleared-v1';
const DB_NAME = 'entrenador-digital';
const SESSION_STORE = 'sessions';
const PRESET_STORE = 'presets';

const app = document.querySelector<HTMLDivElement>('#app');

const exerciseTitles: Record<ExerciseId, string> = {
  arrows: 'Flechas',
  numbers: 'Números',
  colors: 'Colores',
  'color-number': 'Color + número',
  stroop: 'Color y palabra',
  words: 'Palabras',
};

const allDirections: DirectionId[] = ['up', 'up-right', 'right', 'down-right', 'down', 'down-left', 'left', 'up-left'];
const allColors: ColorId[] = ['blue', 'red', 'green', 'yellow', 'orange', 'violet'];

let profiles: TrainingProfile[] = profileLoadAll();
let activeProfileId = localStorage.getItem(ACTIVE_KEY) ?? '';
let cachedHome: HTMLElement | null = null;
let profilesScreenOpen = false;
let applying = false;
let autosaveTimer: number | undefined;
let lastTaggedSessionId = '';

profileEnsureState();
void profileClearOldPresets();

if (app) {
  const observer = new MutationObserver(() => window.setTimeout(profileEnhanceScreen, 0));
  observer.observe(app, { childList: true, subtree: true });
  window.setTimeout(profileEnhanceScreen, 0);
}

function profileDefaults(): SnapshotMap {
  return {
    arrows: {
      kind: 'arrows', repetitions: 20, waitMin: 0.7, waitMax: 2.2, stimulusDuration: 0.9,
      directions: [...allDirections],
    },
    numbers: {
      kind: 'numbers', repetitions: 20, waitMin: 0.7, waitMax: 2.2, stimulusDuration: 0.9,
      minNumber: 1, maxNumber: 9,
    },
    colors: {
      kind: 'colors', repetitions: 20, waitMin: 0.7, waitMax: 2.2, stimulusDuration: 0.9,
      colors: [...allColors],
    },
    'color-number': {
      kind: 'color-number', repetitions: 20, waitMin: 0.7, waitMax: 2.2, stimulusDuration: 0.9,
      minNumber: 1, maxNumber: 9, colors: [...allColors],
    },
    stroop: {
      kind: 'stroop', repetitions: 20, waitMin: 0.85, waitMax: 2.4, stimulusDuration: 1.1,
      colors: [...allColors], instruction: 'ink', allowMatches: false,
    },
    words: {
      kind: 'words', repetitions: 20, waitMin: 0.8, waitMax: 2.3, stimulusDuration: 1.1,
      words: ['ADELANTE', 'ATRÁS', 'IZQUIERDA', 'DERECHA', 'SALTO', 'GIRO'],
    },
  };
}

function profileCloneConfigs(source: SnapshotMap): SnapshotMap {
  return JSON.parse(JSON.stringify(source)) as SnapshotMap;
}

function profileCreate(name: string, source?: SnapshotMap): TrainingProfile {
  const now = new Date().toISOString();
  return {
    schemaVersion: 1,
    id: profileCreateId(),
    name,
    configs: source ? profileCloneConfigs(source) : profileDefaults(),
    createdAt: now,
    updatedAt: now,
  };
}

function profileCreateId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
      const values = new Uint32Array(2);
      crypto.getRandomValues(values);
      return `profile-${values[0].toString(16)}${values[1].toString(16)}`;
    }
  } catch {
    // Fall through to a timestamp id on very old WebViews.
  }
  return `profile-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function profileLoadAll(): TrainingProfile[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((value) => !!value && typeof value === 'object')
      .map((value) => profileNormalize(value as Partial<TrainingProfile>));
  } catch {
    return [];
  }
}

function profileNormalize(candidate: Partial<TrainingProfile>): TrainingProfile {
  const defaults = profileDefaults();
  const raw = candidate.configs as Partial<SnapshotMap> | undefined;
  const now = new Date().toISOString();

  const configs: SnapshotMap = {
    arrows: profileNormalizeExercise(raw?.arrows, defaults.arrows),
    numbers: profileNormalizeExercise(raw?.numbers, defaults.numbers),
    colors: profileNormalizeExercise(raw?.colors, defaults.colors),
    'color-number': profileNormalizeExercise(raw?.['color-number'], defaults['color-number']),
    stroop: profileNormalizeExercise(raw?.stroop, defaults.stroop),
    words: profileNormalizeExercise(raw?.words, defaults.words),
  };

  return {
    schemaVersion: 1,
    id: typeof candidate.id === 'string' && candidate.id ? candidate.id : profileCreateId(),
    name: typeof candidate.name === 'string' && candidate.name.trim() ? candidate.name.trim() : 'Sin nombre',
    configs,
    createdAt: typeof candidate.createdAt === 'string' ? candidate.createdAt : now,
    updatedAt: typeof candidate.updatedAt === 'string' ? candidate.updatedAt : now,
  };
}

function profileNormalizeExercise<T extends ExerciseSnapshot>(candidate: ExerciseSnapshot | undefined, fallback: T): T {
  if (!candidate || candidate.kind !== fallback.kind) return JSON.parse(JSON.stringify(fallback)) as T;
  return { ...JSON.parse(JSON.stringify(fallback)), ...candidate } as T;
}

function profileEnsureState(): void {
  if (!profiles.length) profiles = [profileCreate('General')];
  if (!profiles.some((profile) => profile.id === activeProfileId)) activeProfileId = profiles[0].id;
  profilePersistAll();
  profilePersistActive();
}

function profileActive(): TrainingProfile {
  const current = profiles.find((profile) => profile.id === activeProfileId);
  if (current) return current;
  activeProfileId = profiles[0].id;
  profilePersistActive();
  return profiles[0];
}

function profilePersistAll(): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
}

function profilePersistActive(): void {
  localStorage.setItem(ACTIVE_KEY, activeProfileId);
}

function profileEnhanceScreen(): void {
  if (!app || profilesScreenOpen) return;

  const home = app.querySelector<HTMLElement>('.home-screen');
  if (home) profileEnhanceHome(home);

  const config = app.querySelector<HTMLElement>('.config-screen');
  if (config) profileEnhanceConfig(config);

  const results = app.querySelector<HTMLElement>('.results-screen');
  if (results) profileEnhanceResults(results);

  const settings = app.querySelector<HTMLElement>('.settings-screen');
  if (settings) profileEnhanceSettings(settings);

  if (app.querySelector('.presets-screen')) profileOpenScreen();
}

function profileIconSvg(): string {
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"/><path d="M4.5 21a7.5 7.5 0 0 1 15 0"/></svg>';
}

function profileEnhanceHome(home: HTMLElement): void {
  home.querySelector<HTMLElement>('[data-action="presets"]')?.remove();

  let entry = home.querySelector<HTMLButtonElement>('[data-profile-entry]');
  if (!entry) {
    entry = document.createElement('button');
    entry.type = 'button';
    entry.className = 'active-profile-card';
    entry.dataset.profileEntry = 'true';
    home.querySelector('.exercise-grid')?.before(entry);
  }

  const current = profileActive();
  entry.innerHTML = `
    <span class="active-profile-icon">${profileIconSvg()}</span>
    <span class="active-profile-copy">
      <small>PERFIL ACTIVO</small>
      <strong>${profileEscape(current.name)}</strong>
      <span>Los parámetros se guardan automáticamente</span>
    </span>
    <span class="active-profile-chevron">›</span>`;

  if (entry.dataset.profileBound !== 'true') {
    entry.dataset.profileBound = 'true';
    entry.addEventListener('click', profileOpenScreen);
  }
}

function profileEnhanceConfig(root: HTMLElement): void {
  const form = root.querySelector<HTMLFormElement>('#exercise-config');
  if (!form) return;

  root.querySelector<HTMLElement>('[data-action="save-preset"]')?.remove();
  root.querySelector('.config-actions')?.classList.add('profile-config-actions');

  const exercise = profileCurrentExercise(root);
  if (!exercise) return;

  let context = root.querySelector<HTMLElement>('[data-profile-context]');
  if (!context) {
    context = document.createElement('div');
    context.className = 'profile-context-strip';
    context.dataset.profileContext = 'true';
    root.querySelector('.exercise-intro-card')?.before(context);
  }
  profileRenderContext(context, false);

  const applyKey = `${activeProfileId}:${exercise}`;
  if (root.dataset.profileApplied !== applyKey) {
    root.dataset.profileApplied = applyKey;
    profileApplyToForm(form, profileActive().configs[exercise]);
  }

  if (form.dataset.profileAutosaveBound !== 'true') {
    form.dataset.profileAutosaveBound = 'true';

    const schedule = () => {
      if (applying) return;
      if (autosaveTimer !== undefined) window.clearTimeout(autosaveTimer);
      profileRenderContext(context, true);
      autosaveTimer = window.setTimeout(() => profileSaveForm(form, exercise, context), 220);
    };

    form.addEventListener('input', schedule, true);
    form.addEventListener('change', schedule, true);
    form.addEventListener('submit', () => profileSaveForm(form, exercise, context), true);
    root.querySelector<HTMLButtonElement>('[data-action="back"]')?.addEventListener('click', () => profileSaveForm(form, exercise, context), true);
  }
}

function profileRenderContext(element: HTMLElement, saving: boolean): void {
  const current = profileActive();
  element.innerHTML = `
    <span class="profile-context-icon">${profileIconSvg()}</span>
    <span><small>Perfil activo</small><strong>${profileEscape(current.name)}</strong></span>
    <span class="profile-save-state ${saving ? 'is-saving' : ''}">${saving ? 'Guardando…' : 'Guardado automático'}</span>`;
}

function profileCurrentExercise(root: HTMLElement): ExerciseId | null {
  const title = root.querySelector<HTMLElement>('.topbar h1')?.textContent?.trim() ?? '';
  const ids: ExerciseId[] = ['arrows', 'numbers', 'colors', 'color-number', 'stroop', 'words'];
  return ids.find((id) => exerciseTitles[id] === title) ?? null;
}

function profileParseNumber(value: string): number {
  const normalized = value.trim().replace(',', '.');
  return normalized ? Number(normalized) : Number.NaN;
}

function profileFieldNumber(form: HTMLFormElement, id: string): number {
  const input = form.querySelector<HTMLInputElement>(`#${id}`);
  return input ? profileParseNumber(input.value) : Number.NaN;
}

function profileReadBase(form: HTMLFormElement): BaseSnapshot | null {
  const repetitions = profileFieldNumber(form, 'repetitions');
  const waitMin = profileFieldNumber(form, 'waitMin');
  const waitMax = profileFieldNumber(form, 'waitMax');
  const stimulusDuration = profileFieldNumber(form, 'stimulusDuration');
  if (![repetitions, waitMin, waitMax, stimulusDuration].every(Number.isFinite)) return null;
  return { repetitions, waitMin, waitMax, stimulusDuration };
}

function profileReadForm(form: HTMLFormElement, exercise: ExerciseId): ExerciseSnapshot | null {
  const base = profileReadBase(form);
  if (!base) return null;

  if (exercise === 'arrows') {
    const directions = Array.from(form.querySelectorAll<HTMLInputElement>('input[name="direction"]:checked')).map((input) => input.value as DirectionId);
    return { kind: 'arrows', ...base, directions };
  }

  if (exercise === 'numbers') {
    const minNumber = profileFieldNumber(form, 'minNumber');
    const maxNumber = profileFieldNumber(form, 'maxNumber');
    if (!Number.isFinite(minNumber) || !Number.isFinite(maxNumber)) return null;
    return { kind: 'numbers', ...base, minNumber, maxNumber };
  }

  if (exercise === 'colors') {
    const colors = Array.from(form.querySelectorAll<HTMLInputElement>('input[name="color"]:checked')).map((input) => input.value as ColorId);
    return { kind: 'colors', ...base, colors };
  }

  if (exercise === 'color-number') {
    const minNumber = profileFieldNumber(form, 'minNumber');
    const maxNumber = profileFieldNumber(form, 'maxNumber');
    if (!Number.isFinite(minNumber) || !Number.isFinite(maxNumber)) return null;
    const colors = Array.from(form.querySelectorAll<HTMLInputElement>('input[name="color"]:checked')).map((input) => input.value as ColorId);
    return { kind: 'color-number', ...base, minNumber, maxNumber, colors };
  }

  if (exercise === 'stroop') {
    const colors = Array.from(form.querySelectorAll<HTMLInputElement>('input[name="color"]:checked')).map((input) => input.value as ColorId);
    const instruction = (form.querySelector<HTMLInputElement>('input[name="stroopInstruction"]:checked')?.value ?? 'ink') as StroopMode;
    const allowMatches = form.querySelector<HTMLInputElement>('#allowMatches')?.checked ?? false;
    return { kind: 'stroop', ...base, colors, instruction, allowMatches };
  }

  const words = (form.querySelector<HTMLTextAreaElement>('#wordList')?.value ?? '')
    .split(/\r?\n/)
    .map((word) => word.trim())
    .filter(Boolean);
  return { kind: 'words', ...base, words };
}

function profileSaveForm(form: HTMLFormElement, exercise: ExerciseId, context?: HTMLElement): void {
  if (applying) return;
  const snapshot = profileReadForm(form, exercise);
  if (!snapshot) return;

  const current = profileActive();
  current.configs[exercise] = snapshot;
  current.updatedAt = new Date().toISOString();
  profilePersistAll();
  if (context) profileRenderContext(context, false);
}

function profileSetField(form: HTMLFormElement, id: string, value: number): void {
  const input = form.querySelector<HTMLInputElement>(`#${id}`);
  if (input) input.value = profileFormatNumber(value);
}

function profileFormatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100);
}

function profileApplyToForm(form: HTMLFormElement, snapshot: ExerciseSnapshot): void {
  applying = true;
  try {
    profileSetField(form, 'repetitions', snapshot.repetitions);
    profileSetField(form, 'waitMin', snapshot.waitMin);
    profileSetField(form, 'waitMax', snapshot.waitMax);
    profileSetField(form, 'stimulusDuration', snapshot.stimulusDuration);

    if (snapshot.kind === 'arrows') {
      form.querySelectorAll<HTMLInputElement>('input[name="direction"]').forEach((input) => {
        input.checked = snapshot.directions.includes(input.value as DirectionId);
        input.dispatchEvent(new Event('change', { bubbles: true }));
      });
    }

    if (snapshot.kind === 'numbers' || snapshot.kind === 'color-number') {
      profileSetField(form, 'minNumber', snapshot.minNumber);
      profileSetField(form, 'maxNumber', snapshot.maxNumber);
    }

    if (snapshot.kind === 'colors' || snapshot.kind === 'color-number' || snapshot.kind === 'stroop') {
      form.querySelectorAll<HTMLInputElement>('input[name="color"]').forEach((input) => {
        input.checked = snapshot.colors.includes(input.value as ColorId);
        input.dispatchEvent(new Event('change', { bubbles: true }));
      });
    }

    if (snapshot.kind === 'stroop') {
      const radio = form.querySelector<HTMLInputElement>(`input[name="stroopInstruction"][value="${snapshot.instruction}"]`);
      if (radio) radio.checked = true;
      const allow = form.querySelector<HTMLInputElement>('#allowMatches');
      if (allow) allow.checked = snapshot.allowMatches;
    }

    if (snapshot.kind === 'words') {
      const textarea = form.querySelector<HTMLTextAreaElement>('#wordList');
      if (textarea) textarea.value = snapshot.words.join('\n');
    }
  } finally {
    applying = false;
  }
}

function profileEnhanceResults(root: HTMLElement): void {
  root.querySelector<HTMLElement>('[data-action="save-preset"]')?.remove();
  root.querySelector('.result-actions-three')?.classList.add('profile-results-actions');

  if (!root.querySelector('[data-result-profile]')) {
    const details = root.querySelector('.session-detail-card');
    if (details) {
      const note = document.createElement('div');
      note.className = 'result-profile-note';
      note.dataset.resultProfile = 'true';
      note.innerHTML = `<span>${profileIconSvg()}</span><div><small>Perfil utilizado</small><strong>${profileEscape(profileActive().name)}</strong></div>`;
      details.before(note);
    }
  }

  void profileTagLatestSession();
}

function profileEnhanceSettings(root: HTMLElement): void {
  const clearPresets = root.querySelector<HTMLElement>('[data-action="clear-presets"]');
  const card = clearPresets?.closest('.settings-card');
  clearPresets?.remove();
  card?.classList.add('profiles-settings-clean');
}

function profileOpenScreen(): void {
  if (!app || profilesScreenOpen) return;
  const home = app.querySelector<HTMLElement>('.home-screen');
  if (home) cachedHome = home;
  profilesScreenOpen = true;
  profileRenderScreen();
}

function profileClearApp(): void {
  if (!app) return;
  while (app.firstChild) app.removeChild(app.firstChild);
}

function profileRenderScreen(): void {
  if (!app) return;
  const current = profileActive();
  const root = document.createElement('main');
  root.className = 'app-shell profiles-screen profiles-screen-v2';
  root.innerHTML = `
    <header class="topbar profiles-topbar">
      <button class="icon-button" data-action="back" aria-label="Volver">←</button>
      <div><h1>Perfiles</h1><p>Configuraciones globales de entrenamiento</p></div>
      <button class="profile-add-button" type="button" data-profile-add aria-label="Crear perfil">+</button>
    </header>

    <section class="profiles-intro">
      <span class="profiles-intro-icon">${profileIconSvg()}</span>
      <div><small>PERFIL ACTIVO</small><strong>${profileEscape(current.name)}</strong><p>Cualquier cambio que hagas en los ejercicios se guarda automáticamente en este perfil.</p></div>
    </section>

    <div class="profiles-list">${profiles.map(profileCardHtml).join('')}</div>`;

  profileClearApp();
  app.appendChild(root);

  root.querySelector<HTMLButtonElement>('[data-action="back"]')?.addEventListener('click', profileRestoreHome);
  root.querySelector<HTMLButtonElement>('[data-profile-add]')?.addEventListener('click', profileOpenCreateModal);

  root.querySelectorAll<HTMLButtonElement>('[data-profile-select]').forEach((button) => {
    button.addEventListener('click', () => {
      const id = button.dataset.profileSelect;
      if (!id || id === activeProfileId) return;
      activeProfileId = id;
      profilePersistActive();
      profileRenderScreen();
    });
  });

  root.querySelectorAll<HTMLButtonElement>('[data-profile-duplicate]').forEach((button) => {
    button.addEventListener('click', () => {
      const source = profiles.find((profile) => profile.id === button.dataset.profileDuplicate);
      if (!source) return;
      const copy = profileCreate(`${source.name} copia`, source.configs);
      profiles.push(copy);
      activeProfileId = copy.id;
      profilePersistAll();
      profilePersistActive();
      profileRenderScreen();
    });
  });

  root.querySelectorAll<HTMLButtonElement>('[data-profile-rename]').forEach((button) => {
    button.addEventListener('click', () => {
      const target = profiles.find((profile) => profile.id === button.dataset.profileRename);
      if (target) profileOpenRenameModal(target);
    });
  });

  root.querySelectorAll<HTMLButtonElement>('[data-profile-delete]').forEach((button) => {
    button.addEventListener('click', () => {
      const target = profiles.find((profile) => profile.id === button.dataset.profileDelete);
      if (target) profileOpenDeleteModal(target);
    });
  });
}

function profileCardHtml(profile: TrainingProfile): string {
  const active = profile.id === activeProfileId;
  return `
    <article class="profile-list-card ${active ? 'is-active' : ''}">
      <button class="profile-select-area" type="button" data-profile-select="${profileEscape(profile.id)}">
        <span class="profile-avatar">${profileEscape(profileInitials(profile.name))}</span>
        <span class="profile-list-copy">
          <span class="profile-name-line"><strong>${profileEscape(profile.name)}</strong>${active ? '<em>ACTIVO</em>' : ''}</span>
          <small>${profileUpdatedText(profile.updatedAt)}</small>
        </span>
        <span class="profile-select-mark">${active ? '✓' : '›'}</span>
      </button>
      <div class="profile-card-actions">
        <button type="button" data-profile-duplicate="${profileEscape(profile.id)}">Duplicar</button>
        <button type="button" data-profile-rename="${profileEscape(profile.id)}">Renombrar</button>
        <button type="button" data-profile-delete="${profileEscape(profile.id)}" ${profiles.length <= 1 ? 'disabled' : ''}>Eliminar</button>
      </div>
    </article>`;
}

function profileInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'P';
  return parts.slice(0, 2).map((part) => part.charAt(0).toLocaleUpperCase('es')).join('');
}

function profileUpdatedText(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Configuración guardada';
  return `Actualizado ${date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })} · ${date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`;
}

function profileRestoreHome(): void {
  if (!app) return;
  profileCloseModal();
  profilesScreenOpen = false;
  if (cachedHome) {
    const home = cachedHome;
    cachedHome = null;
    profileClearApp();
    app.appendChild(home);
    profileEnhanceHome(home);
    window.scrollTo(0, 0);
    return;
  }
  window.location.reload();
}

function profileOpenCreateModal(): void {
  const current = profileActive();
  const overlay = profileMakeModal(`
    <h2>Nuevo perfil</h2>
    <p>Crea un espacio independiente para guardar todos los parámetros de entrenamiento.</p>
    <label class="profile-modal-field"><span>Nombre del perfil</span><input id="new-profile-name" type="text" maxlength="40" autocomplete="off" placeholder="Ej.: Fútbol Sub-17"></label>
    <div class="profile-create-options">
      <label><input type="radio" name="profile-source" value="current" checked><span><strong>Duplicar perfil actual</strong><small>Parte de la configuración de ${profileEscape(current.name)}.</small></span></label>
      <label><input type="radio" name="profile-source" value="default"><span><strong>Usar valores iniciales</strong><small>Comienza con la configuración original de la app.</small></span></label>
    </div>
    <div class="modal-actions"><button class="secondary-button" data-profile-modal-close>Cancelar</button><button class="primary-button" data-profile-create>Crear perfil</button></div>`);

  const input = overlay.querySelector<HTMLInputElement>('#new-profile-name');
  window.setTimeout(() => input?.focus(), 40);
  overlay.querySelector<HTMLButtonElement>('[data-profile-create]')?.addEventListener('click', () => {
    const name = (input?.value ?? '').trim();
    if (!name) {
      input?.focus();
      return;
    }
    const source = overlay.querySelector<HTMLInputElement>('input[name="profile-source"]:checked')?.value;
    const created = profileCreate(name, source === 'current' ? current.configs : undefined);
    profiles.push(created);
    activeProfileId = created.id;
    profilePersistAll();
    profilePersistActive();
    profileCloseModal();
    profileRenderScreen();
  });
}

function profileOpenRenameModal(target: TrainingProfile): void {
  const overlay = profileMakeModal(`
    <h2>Renombrar perfil</h2>
    <p>Solo cambia el nombre; todos los parámetros se conservan.</p>
    <label class="profile-modal-field"><span>Nombre</span><input id="rename-profile-name" type="text" maxlength="40" value="${profileEscape(target.name)}" autocomplete="off"></label>
    <div class="modal-actions"><button class="secondary-button" data-profile-modal-close>Cancelar</button><button class="primary-button" data-profile-rename-save>Guardar</button></div>`);
  const input = overlay.querySelector<HTMLInputElement>('#rename-profile-name');
  window.setTimeout(() => { input?.focus(); input?.select(); }, 40);
  overlay.querySelector<HTMLButtonElement>('[data-profile-rename-save]')?.addEventListener('click', () => {
    const name = (input?.value ?? '').trim();
    if (!name) return;
    target.name = name;
    target.updatedAt = new Date().toISOString();
    profilePersistAll();
    profileCloseModal();
    profileRenderScreen();
  });
}

function profileOpenDeleteModal(target: TrainingProfile): void {
  if (profiles.length <= 1) return;
  const overlay = profileMakeModal(`
    <h2>Eliminar perfil</h2>
    <p>Se eliminará “${profileEscape(target.name)}” y los parámetros guardados dentro de ese perfil. El historial realizado no se borra.</p>
    <div class="modal-actions"><button class="secondary-button" data-profile-modal-close>Cancelar</button><button class="danger-button" data-profile-delete-confirm>Eliminar</button></div>`);
  overlay.querySelector<HTMLButtonElement>('[data-profile-delete-confirm]')?.addEventListener('click', () => {
    profiles = profiles.filter((profile) => profile.id !== target.id);
    if (activeProfileId === target.id) activeProfileId = profiles[0].id;
    profilePersistAll();
    profilePersistActive();
    profileCloseModal();
    profileRenderScreen();
  });
}

function profileMakeModal(content: string): HTMLElement {
  profileCloseModal();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay profile-modal-overlay';
  overlay.innerHTML = `<section class="app-modal profile-modal" role="dialog" aria-modal="true">${content}</section>`;
  document.body.appendChild(overlay);
  overlay.querySelectorAll<HTMLButtonElement>('[data-profile-modal-close]').forEach((button) => button.addEventListener('click', profileCloseModal));
  overlay.addEventListener('click', (event) => { if (event.target === overlay) profileCloseModal(); });
  return overlay;
}

function profileCloseModal(): void {
  document.querySelector('.profile-modal-overlay')?.remove();
}

async function profileClearOldPresets(): Promise<void> {
  if (localStorage.getItem(PRESETS_CLEARED_KEY) === '1' || typeof indexedDB === 'undefined') return;
  try {
    const db = await profileOpenAppDb();
    if (db.objectStoreNames.contains(PRESET_STORE)) {
      await new Promise<void>((resolve) => {
        const transaction = db.transaction(PRESET_STORE, 'readwrite');
        transaction.objectStore(PRESET_STORE).clear();
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => resolve();
        transaction.onabort = () => resolve();
      });
    }
    db.close();
    localStorage.setItem(PRESETS_CLEARED_KEY, '1');
  } catch {
    // Best-effort cleanup only.
  }
}

async function profileTagLatestSession(): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  try {
    const db = await profileOpenAppDb();
    if (!db.objectStoreNames.contains(SESSION_STORE)) {
      db.close();
      return;
    }

    const sessions = await profileReadSessions(db);
    sessions.sort((a, b) => String(b.finishedAt ?? '').localeCompare(String(a.finishedAt ?? '')));
    const latest = sessions[0];
    if (!latest?.id || latest.id === lastTaggedSessionId) {
      db.close();
      return;
    }

    const finishedTime = latest.finishedAt ? new Date(latest.finishedAt).getTime() : 0;
    if (finishedTime && Math.abs(Date.now() - finishedTime) > 30000) {
      db.close();
      return;
    }

    const current = profileActive();
    latest.profileId = current.id;
    latest.profileName = current.name;
    await profilePutSession(db, latest);
    lastTaggedSessionId = latest.id;
    db.close();
  } catch {
    // Profile metadata must never block results.
  }
}

function profileOpenAppDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function profileReadSessions(db: IDBDatabase): Promise<SessionRecord[]> {
  return new Promise((resolve) => {
    const values: SessionRecord[] = [];
    const transaction = db.transaction(SESSION_STORE, 'readonly');
    const request = transaction.objectStore(SESSION_STORE).openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;
      values.push(cursor.value as SessionRecord);
      cursor.continue();
    };
    transaction.oncomplete = () => resolve(values);
    transaction.onerror = () => resolve(values);
    transaction.onabort = () => resolve(values);
  });
}

function profilePutSession(db: IDBDatabase, session: SessionRecord): Promise<void> {
  return new Promise((resolve) => {
    const transaction = db.transaction(SESSION_STORE, 'readwrite');
    transaction.objectStore(SESSION_STORE).put(session);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => resolve();
    transaction.onabort = () => resolve();
  });
}

function profileEscape(value: string): string {
  const entities: Record<string, string> = {
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  };
  return value.replace(/[&<>"']/g, (character) => entities[character] ?? character);
}
