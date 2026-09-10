type ProfileExerciseId = 'arrows' | 'numbers' | 'colors' | 'color-number' | 'stroop' | 'words';
type ProfileDirection = 'up' | 'up-right' | 'right' | 'down-right' | 'down' | 'down-left' | 'left' | 'up-left';
type ProfileColor = 'blue' | 'red' | 'green' | 'yellow' | 'orange' | 'violet';
type ProfileStroopInstruction = 'ink' | 'word';

interface ProfileBaseConfig {
  repetitions: number;
  waitMin: number;
  waitMax: number;
  stimulusDuration: number;
}

interface ProfileArrowsConfig extends ProfileBaseConfig {
  kind: 'arrows';
  directions: ProfileDirection[];
}

interface ProfileNumbersConfig extends ProfileBaseConfig {
  kind: 'numbers';
  minNumber: number;
  maxNumber: number;
}

interface ProfileColorsConfig extends ProfileBaseConfig {
  kind: 'colors';
  colors: ProfileColor[];
}

interface ProfileColorNumberConfig extends ProfileBaseConfig {
  kind: 'color-number';
  minNumber: number;
  maxNumber: number;
  colors: ProfileColor[];
}

interface ProfileStroopConfig extends ProfileBaseConfig {
  kind: 'stroop';
  colors: ProfileColor[];
  instruction: ProfileStroopInstruction;
  allowMatches: boolean;
}

interface ProfileWordsConfig extends ProfileBaseConfig {
  kind: 'words';
  words: string[];
}

type ProfileExerciseConfig =
  | ProfileArrowsConfig
  | ProfileNumbersConfig
  | ProfileColorsConfig
  | ProfileColorNumberConfig
  | ProfileStroopConfig
  | ProfileWordsConfig;

type ProfileConfigMap = Record<ProfileExerciseId, ProfileExerciseConfig>;

interface TrainingProfile {
  schemaVersion: 1;
  id: string;
  name: string;
  configs: ProfileConfigMap;
  createdAt: string;
  updatedAt: string;
}

interface SessionWithProfile {
  id?: string;
  finishedAt?: string;
  profileId?: string;
  profileName?: string;
  [key: string]: unknown;
}

const PROFILE_STORAGE_KEY = 'entrenador-digital-profiles-v1';
const ACTIVE_PROFILE_KEY = 'entrenador-digital-active-profile-v1';
const OLD_PRESETS_CLEARED_KEY = 'entrenador-digital-old-presets-cleared-v1';
const APP_DB_NAME = 'entrenador-digital';
const APP_DB_PRESET_STORE = 'presets';
const APP_DB_SESSION_STORE = 'sessions';

const profileApp = document.querySelector<HTMLDivElement>('#app');

const profileExerciseTitles: Record<ProfileExerciseId, string> = {
  arrows: 'Flechas',
  numbers: 'Números',
  colors: 'Colores',
  'color-number': 'Color + número',
  stroop: 'Color y palabra',
  words: 'Palabras',
};

const titleToExercise = Object.entries(profileExerciseTitles).reduce<Record<string, ProfileExerciseId>>((result, [id, title]) => {
  result[title] = id as ProfileExerciseId;
  return result;
}, {});

const allDirections: ProfileDirection[] = [
  'up',
  'up-right',
  'right',
  'down-right',
  'down',
  'down-left',
  'left',
  'up-left',
];

const allColors: ProfileColor[] = ['blue', 'red', 'green', 'yellow', 'orange', 'violet'];

let profiles = loadProfiles();
let activeProfileId = loadActiveProfileId();
let cachedHome: HTMLElement | null = null;
let profilesScreenOpen = false;
let applyingProfile = false;
let autosaveTimer: number | undefined;
let lastTaggedSessionId = '';

ensureProfileState();
void clearLegacyPresets();

if (profileApp) {
  const observer = new MutationObserver(() => scheduleEnhancement());
  observer.observe(profileApp, { childList: true, subtree: true });
  scheduleEnhancement();
}

function defaultProfileConfigs(): ProfileConfigMap {
  return {
    arrows: {
      kind: 'arrows',
      repetitions: 20,
      waitMin: 0.7,
      waitMax: 2.2,
      stimulusDuration: 0.9,
      directions: [...allDirections],
    },
    numbers: {
      kind: 'numbers',
      repetitions: 20,
      waitMin: 0.7,
      waitMax: 2.2,
      stimulusDuration: 0.9,
      minNumber: 1,
      maxNumber: 9,
    },
    colors: {
      kind: 'colors',
      repetitions: 20,
      waitMin: 0.7,
      waitMax: 2.2,
      stimulusDuration: 0.9,
      colors: [...allColors],
    },
    'color-number': {
      kind: 'color-number',
      repetitions: 20,
      waitMin: 0.7,
      waitMax: 2.2,
      stimulusDuration: 0.9,
      minNumber: 1,
      maxNumber: 9,
      colors: [...allColors],
    },
    stroop: {
      kind: 'stroop',
      repetitions: 20,
      waitMin: 0.85,
      waitMax: 2.4,
      stimulusDuration: 1.1,
      colors: [...allColors],
      instruction: 'ink',
      allowMatches: false,
    },
    words: {
      kind: 'words',
      repetitions: 20,
      waitMin: 0.8,
      waitMax: 2.3,
      stimulusDuration: 1.1,
      words: ['ADELANTE', 'ATRÁS', 'IZQUIERDA', 'DERECHA', 'SALTO', 'GIRO'],
    },
  };
}

function cloneProfileConfigs(configs: ProfileConfigMap): ProfileConfigMap {
  return JSON.parse(JSON.stringify(configs)) as ProfileConfigMap;
}

function makeProfile(name: string, source?: ProfileConfigMap): TrainingProfile {
  const now = new Date().toISOString();
  return {
    schemaVersion: 1,
    id: createProfileId(),
    name,
    configs: source ? cloneProfileConfigs(source) : defaultProfileConfigs(),
    createdAt: now,
    updatedAt: now,
  };
}

function createProfileId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const values = new Uint32Array(2);
    crypto.getRandomValues(values);
    return `profile-${values[0].toString(16)}${values[1].toString(16)}`;
  }
  return `profile-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function loadProfiles(): TrainingProfile[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(PROFILE_STORAGE_KEY) ?? '[]') as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isProfileLike).map(normalizeProfile);
  } catch {
    return [];
  }
}

function isProfileLike(value: unknown): value is TrainingProfile {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<TrainingProfile>;
  return typeof candidate.id === 'string' && typeof candidate.name === 'string' && !!candidate.configs;
}

function normalizeProfile(profile: TrainingProfile): TrainingProfile {
  const defaults = defaultProfileConfigs();
  const rawConfigs = profile.configs as Partial<ProfileConfigMap>;
  return {
    schemaVersion: 1,
    id: profile.id,
    name: profile.name || 'Sin nombre',
    configs: {
      arrows: normalizeExerciseConfig(rawConfigs.arrows, defaults.arrows),
      numbers: normalizeExerciseConfig(rawConfigs.numbers, defaults.numbers),
      colors: normalizeExerciseConfig(rawConfigs.colors, defaults.colors),
      'color-number': normalizeExerciseConfig(rawConfigs['color-number'], defaults['color-number']),
      stroop: normalizeExerciseConfig(rawConfigs.stroop, defaults.stroop),
      words: normalizeExerciseConfig(rawConfigs.words, defaults.words),
    },
    createdAt: profile.createdAt || new Date().toISOString(),
    updatedAt: profile.updatedAt || profile.createdAt || new Date().toISOString(),
  };
}

function normalizeExerciseConfig<T extends ProfileExerciseConfig>(candidate: T | undefined, fallback: T): T {
  if (!candidate || candidate.kind !== fallback.kind) return JSON.parse(JSON.stringify(fallback)) as T;
  return { ...JSON.parse(JSON.stringify(fallback)), ...candidate } as T;
}

function loadActiveProfileId(): string {
  return localStorage.getItem(ACTIVE_PROFILE_KEY) ?? '';
}

function ensureProfileState(): void {
  if (!profiles.length) profiles = [makeProfile('General')];
  if (!profiles.some((profile) => profile.id === activeProfileId)) activeProfileId = profiles[0].id;
  persistProfiles();
  persistActiveProfile();
}

function activeProfile(): TrainingProfile {
  const found = profiles.find((profile) => profile.id === activeProfileId);
  if (found) return found;
  activeProfileId = profiles[0].id;
  persistActiveProfile();
  return profiles[0];
}

function persistProfiles(): void {
  localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profiles));
}

function persistActiveProfile(): void {
  localStorage.setItem(ACTIVE_PROFILE_KEY, activeProfileId);
}

function scheduleEnhancement(): void {
  window.setTimeout(enhanceCurrentScreen, 0);
}

function enhanceCurrentScreen(): void {
  if (!profileApp || profilesScreenOpen) return;

  const home = profileApp.querySelector<HTMLElement>('.home-screen');
  if (home) enhanceHome(home);

  const config = profileApp.querySelector<HTMLElement>('.config-screen');
  if (config) enhanceConfig(config);

  const results = profileApp.querySelector<HTMLElement>('.results-screen');
  if (results) enhanceResults(results);

  const settings = profileApp.querySelector<HTMLElement>('.settings-screen');
  if (settings) enhanceSettings(settings);

  const legacyPresets = profileApp.querySelector<HTMLElement>('.presets-screen');
  if (legacyPresets) openProfilesScreen();
}

function profileSvg(): string {
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"/><path d="M4.5 21a7.5 7.5 0 0 1 15 0"/></svg>';
}

function enhanceHome(home: HTMLElement): void {
  const oldPresets = home.querySelector<HTMLElement>('[data-action="presets"]');
  oldPresets?.remove();

  let card = home.querySelector<HTMLButtonElement>('[data-profile-entry]');
  if (!card) {
    card = document.createElement('button');
    card.type = 'button';
    card.className = 'active-profile-card';
    card.dataset.profileEntry = 'true';
    const exerciseGrid = home.querySelector('.exercise-grid');
    exerciseGrid?.before(card);
  }

  const profile = activeProfile();
  card.innerHTML = `
    <span class="active-profile-icon">${profileSvg()}</span>
    <span class="active-profile-copy">
      <small>PERFIL ACTIVO</small>
      <strong>${escapeProfileHtml(profile.name)}</strong>
      <span>Los parámetros se guardan automáticamente</span>
    </span>
    <span class="active-profile-chevron">›</span>`;

  if (!card.dataset.listenerBound) {
    card.dataset.listenerBound = 'true';
    card.addEventListener('click', openProfilesScreen);
  }
}

function enhanceConfig(root: HTMLElement): void {
  const form = root.querySelector<HTMLFormElement>('#exercise-config');
  if (!form) return;

  root.querySelector<HTMLElement>('[data-action="save-preset"]')?.remove();
  root.querySelector('.config-actions')?.classList.add('profile-config-actions');

  const exercise = currentExerciseFromConfig(root);
  if (!exercise) return;

  let context = root.querySelector<HTMLElement>('[data-profile-context]');
  if (!context) {
    context = document.createElement('div');
    context.className = 'profile-context-strip';
    context.dataset.profileContext = 'true';
    const intro = root.querySelector('.exercise-intro-card');
    intro?.before(context);
  }
  updateProfileContext(context, 'saved');

  const applyKey = `${activeProfileId}:${exercise}`;
  if (root.dataset.profileApplied !== applyKey) {
    root.dataset.profileApplied = applyKey;
    applyConfigToForm(form, activeProfile().configs[exercise]);
  }

  if (form.dataset.profileAutosaveBound !== 'true') {
    form.dataset.profileAutosaveBound = 'true';
    const scheduleSave = () => {
      if (applyingProfile) return;
      if (autosaveTimer !== undefined) window.clearTimeout(autosaveTimer);
      updateProfileContext(context, 'saving');
      autosaveTimer = window.setTimeout(() => {
        saveFormIntoActiveProfile(form, exercise, context);
      }, 220);
    };
    form.addEventListener('input', scheduleSave, true);
    form.addEventListener('change', scheduleSave, true);
    form.addEventListener('submit', () => saveFormIntoActiveProfile(form, exercise, context), true);
    root.querySelector<HTMLButtonElement>('[data-action="back"]')?.addEventListener(
      'click',
      () => saveFormIntoActiveProfile(form, exercise, context),
      true,
    );
  }
}

function updateProfileContext(element: HTMLElement, status: 'saving' | 'saved'): void {
  const profile = activeProfile();
  element.innerHTML = `
    <span class="profile-context-icon">${profileSvg()}</span>
    <span><small>Perfil activo</small><strong>${escapeProfileHtml(profile.name)}</strong></span>
    <span class="profile-save-state ${status === 'saving' ? 'is-saving' : ''}">${status === 'saving' ? 'Guardando…' : 'Guardado automático'}</span>`;
}

function currentExerciseFromConfig(root: HTMLElement): ProfileExerciseId | null {
  const title = root.querySelector<HTMLElement>('.topbar h1')?.textContent?.trim() ?? '';
  return titleToExercise[title] ?? null;
}

function parseLocaleNumber(value: string): number {
  const normalized = value.trim().replace(',', '.');
  return normalized === '' ? Number.NaN : Number(normalized);
}

function inputNumber(form: HTMLFormElement, id: string): number {
  const input = form.querySelector<HTMLInputElement>(`#${id}`);
  return input ? parseLocaleNumber(input.value) : Number.NaN;
}

function readBaseFromForm(form: HTMLFormElement): ProfileBaseConfig | null {
  const repetitions = inputNumber(form, 'repetitions');
  const waitMin = inputNumber(form, 'waitMin');
  const waitMax = inputNumber(form, 'waitMax');
  const stimulusDuration = inputNumber(form, 'stimulusDuration');
  if (![repetitions, waitMin, waitMax, stimulusDuration].every(Number.isFinite)) return null;
  return { repetitions, waitMin, waitMax, stimulusDuration };
}

function readConfigFromForm(form: HTMLFormElement, exercise: ProfileExerciseId): ProfileExerciseConfig | null {
  const base = readBaseFromForm(form);
  if (!base) return null;

  if (exercise === 'arrows') {
    const directions = Array.from(form.querySelectorAll<HTMLInputElement>('input[name="direction"]:checked'))
      .map((input) => input.value as ProfileDirection);
    return { kind: 'arrows', ...base, directions };
  }

  if (exercise === 'numbers') {
    const minNumber = inputNumber(form, 'minNumber');
    const maxNumber = inputNumber(form, 'maxNumber');
    if (!Number.isFinite(minNumber) || !Number.isFinite(maxNumber)) return null;
    return { kind: 'numbers', ...base, minNumber, maxNumber };
  }

  if (exercise === 'colors') {
    const colors = Array.from(form.querySelectorAll<HTMLInputElement>('input[name="color"]:checked'))
      .map((input) => input.value as ProfileColor);
    return { kind: 'colors', ...base, colors };
  }

  if (exercise === 'color-number') {
    const minNumber = inputNumber(form, 'minNumber');
    const maxNumber = inputNumber(form, 'maxNumber');
    if (!Number.isFinite(minNumber) || !Number.isFinite(maxNumber)) return null;
    const colors = Array.from(form.querySelectorAll<HTMLInputElement>('input[name="color"]:checked'))
      .map((input) => input.value as ProfileColor);
    return { kind: 'color-number', ...base, minNumber, maxNumber, colors };
  }

  if (exercise === 'stroop') {
    const colors = Array.from(form.querySelectorAll<HTMLInputElement>('input[name="color"]:checked'))
      .map((input) => input.value as ProfileColor);
    const instruction = (form.querySelector<HTMLInputElement>('input[name="stroopInstruction"]:checked')?.value ?? 'ink') as ProfileStroopInstruction;
    const allowMatches = form.querySelector<HTMLInputElement>('#allowMatches')?.checked ?? false;
    return { kind: 'stroop', ...base, colors, instruction, allowMatches };
  }

  const words = (form.querySelector<HTMLTextAreaElement>('#wordList')?.value ?? '')
    .split(/\r?\n/)
    .map((word) => word.trim())
    .filter(Boolean);
  return { kind: 'words', ...base, words };
}

function saveFormIntoActiveProfile(form: HTMLFormElement, exercise: ProfileExerciseId, context?: HTMLElement): void {
  if (applyingProfile) return;
  const config = readConfigFromForm(form, exercise);
  if (!config) {
    if (context) updateProfileContext(context, 'saving');
    return;
  }

  const profile = activeProfile();
  profile.configs[exercise] = config;
  profile.updatedAt = new Date().toISOString();
  persistProfiles();
  if (context) updateProfileContext(context, 'saved');
}

function setInputValue(form: HTMLFormElement, id: string, value: number): void {
  const input = form.querySelector<HTMLInputElement>(`#${id}`);
  if (input) input.value = formatProfileNumber(value);
}

function formatProfileNumber(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return String(Math.round(value * 100) / 100);
}

function applyConfigToForm(form: HTMLFormElement, config: ProfileExerciseConfig): void {
  applyingProfile = true;
  try {
    setInputValue(form, 'repetitions', config.repetitions);
    setInputValue(form, 'waitMin', config.waitMin);
    setInputValue(form, 'waitMax', config.waitMax);
    setInputValue(form, 'stimulusDuration', config.stimulusDuration);

    if (config.kind === 'arrows') {
      form.querySelectorAll<HTMLInputElement>('input[name="direction"]').forEach((input) => {
        input.checked = config.directions.includes(input.value as ProfileDirection);
        input.dispatchEvent(new Event('change', { bubbles: true }));
      });
    }

    if (config.kind === 'numbers' || config.kind === 'color-number') {
      setInputValue(form, 'minNumber', config.minNumber);
      setInputValue(form, 'maxNumber', config.maxNumber);
    }

    if (config.kind === 'colors' || config.kind === 'color-number' || config.kind === 'stroop') {
      form.querySelectorAll<HTMLInputElement>('input[name="color"]').forEach((input) => {
        input.checked = config.colors.includes(input.value as ProfileColor);
        input.dispatchEvent(new Event('change', { bubbles: true }));
      });
    }

    if (config.kind === 'stroop') {
      const radio = form.querySelector<HTMLInputElement>(`input[name="stroopInstruction"][value="${config.instruction}"]`);
      if (radio) radio.checked = true;
      const allowMatches = form.querySelector<HTMLInputElement>('#allowMatches');
      if (allowMatches) allowMatches.checked = config.allowMatches;
    }

    if (config.kind === 'words') {
      const textarea = form.querySelector<HTMLTextAreaElement>('#wordList');
      if (textarea) textarea.value = config.words.join('\n');
    }
  } finally {
    applyingProfile = false;
  }
}

function enhanceResults(root: HTMLElement): void {
  root.querySelector<HTMLElement>('[data-action="save-preset"]')?.remove();
  root.querySelector('.result-actions-three')?.classList.add('profile-results-actions');

  if (!root.querySelector('[data-result-profile]')) {
    const details = root.querySelector('.session-detail-card');
    if (details) {
      const row = document.createElement('div');
      row.className = 'result-profile-note';
      row.dataset.resultProfile = 'true';
      row.innerHTML = `<span>${profileSvg()}</span><div><small>Perfil utilizado</small><strong>${escapeProfileHtml(activeProfile().name)}</strong></div>`;
      details.before(row);
    }
  }

  void tagLatestSessionWithProfile();
}

function enhanceSettings(root: HTMLElement): void {
  const clearPresetsButton = root.querySelector<HTMLElement>('[data-action="clear-presets"]');
  const containingCard = clearPresetsButton?.closest('.settings-card');
  clearPresetsButton?.remove();
  if (containingCard) containingCard.classList.add('profiles-settings-clean');
}

function openProfilesScreen(): void {
  if (!profileApp || profilesScreenOpen) return;

  const currentHome = profileApp.querySelector<HTMLElement>('.home-screen');
  if (currentHome) cachedHome = currentHome;

  profilesScreenOpen = true;
  renderProfilesScreen();
}

function renderProfilesScreen(): void {
  if (!profileApp) return;
  const profile = activeProfile();
  const wrapper = document.createElement('main');
  wrapper.className = 'app-shell profiles-screen profiles-screen-v2';
  wrapper.innerHTML = `
    <header class="topbar profiles-topbar">
      <button class="icon-button" data-action="back" aria-label="Volver">←</button>
      <div><h1>Perfiles</h1><p>Configuraciones globales de entrenamiento</p></div>
      <button class="profile-add-button" type="button" data-profile-add aria-label="Crear perfil">+</button>
    </header>

    <section class="profiles-intro">
      <span class="profiles-intro-icon">${profileSvg()}</span>
      <div><small>PERFIL ACTIVO</small><strong>${escapeProfileHtml(profile.name)}</strong><p>Cualquier cambio que hagas en los ejercicios se guarda automáticamente en este perfil.</p></div>
    </section>

    <div class="profiles-list">
      ${profiles.map(profileListCard).join('')}
    </div>`;

  profileApp.replaceChildren(wrapper);

  wrapper.querySelector<HTMLButtonElement>('[data-action="back"]')?.addEventListener('click', restoreHome);
  wrapper.querySelector<HTMLButtonElement>('[data-profile-add]')?.addEventListener('click', openCreateProfileModal);

  wrapper.querySelectorAll<HTMLButtonElement>('[data-profile-select]').forEach((button) => {
    button.addEventListener('click', () => {
      const id = button.dataset.profileSelect;
      if (!id || id === activeProfileId) return;
      activeProfileId = id;
      persistActiveProfile();
      renderProfilesScreen();
    });
  });

  wrapper.querySelectorAll<HTMLButtonElement>('[data-profile-duplicate]').forEach((button) => {
    button.addEventListener('click', () => {
      const source = profiles.find((item) => item.id === button.dataset.profileDuplicate);
      if (source) duplicateProfile(source);
    });
  });

  wrapper.querySelectorAll<HTMLButtonElement>('[data-profile-rename]').forEach((button) => {
    button.addEventListener('click', () => {
      const source = profiles.find((item) => item.id === button.dataset.profileRename);
      if (source) openRenameProfileModal(source);
    });
  });

  wrapper.querySelectorAll<HTMLButtonElement>('[data-profile-delete]').forEach((button) => {
    button.addEventListener('click', () => {
      const source = profiles.find((item) => item.id === button.dataset.profileDelete);
      if (source) openDeleteProfileModal(source);
    });
  });
}

function profileListCard(profile: TrainingProfile): string {
  const active = profile.id === activeProfileId;
  return `
    <article class="profile-list-card ${active ? 'is-active' : ''}">
      <button class="profile-select-area" type="button" data-profile-select="${escapeProfileAttribute(profile.id)}">
        <span class="profile-avatar">${escapeProfileHtml(profileInitials(profile.name))}</span>
        <span class="profile-list-copy">
          <span class="profile-name-line"><strong>${escapeProfileHtml(profile.name)}</strong>${active ? '<em>ACTIVO</em>' : ''}</span>
          <small>${formatProfileUpdatedAt(profile.updatedAt)}</small>
        </span>
        <span class="profile-select-mark">${active ? '✓' : '›'}</span>
      </button>
      <div class="profile-card-actions">
        <button type="button" data-profile-duplicate="${escapeProfileAttribute(profile.id)}">Duplicar</button>
        <button type="button" data-profile-rename="${escapeProfileAttribute(profile.id)}">Renombrar</button>
        <button type="button" data-profile-delete="${escapeProfileAttribute(profile.id)}" ${profiles.length <= 1 ? 'disabled' : ''}>Eliminar</button>
      </div>
    </article>`;
}

function profileInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'P';
  return parts.slice(0, 2).map((part) => part.charAt(0).toLocaleUpperCase('es')).join('');
}

function formatProfileUpdatedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Configuración guardada';
  return `Actualizado ${date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })} · ${date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`;
}

function restoreHome(): void {
  if (!profileApp) return;
  closeProfileModal();
  profilesScreenOpen = false;
  if (cachedHome) {
    const home = cachedHome;
    cachedHome = null;
    profileApp.replaceChildren(home);
    enhanceHome(home);
    window.scrollTo(0, 0);
    return;
  }
  window.location.reload();
}

function openCreateProfileModal(): void {
  closeProfileModal();
  const overlay = createProfileModal(`
    <h2>Nuevo perfil</h2>
    <p>Crea un espacio independiente para guardar todos los parámetros de entrenamiento.</p>
    <label class="profile-modal-field"><span>Nombre del perfil</span><input id="new-profile-name" type="text" maxlength="40" autocomplete="off" placeholder="Ej.: Fútbol Sub-17"></label>
    <div class="profile-create-options">
      <label><input type="radio" name="profile-source" value="current" checked><span><strong>Duplicar perfil actual</strong><small>Parte de la configuración de ${escapeProfileHtml(activeProfile().name)}.</small></span></label>
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
    const newProfile = makeProfile(name, source === 'current' ? activeProfile().configs : undefined);
    profiles.push(newProfile);
    activeProfileId = newProfile.id;
    persistProfiles();
    persistActiveProfile();
    closeProfileModal();
    renderProfilesScreen();
  });
}

function duplicateProfile(source: TrainingProfile): void {
  const copy = makeProfile(`${source.name} copia`, source.configs);
  profiles.push(copy);
  activeProfileId = copy.id;
  persistProfiles();
  persistActiveProfile();
  renderProfilesScreen();
}

function openRenameProfileModal(profile: TrainingProfile): void {
  closeProfileModal();
  const overlay = createProfileModal(`
    <h2>Renombrar perfil</h2>
    <p>El cambio de nombre no modifica ninguna configuración ni sesión guardada.</p>
    <label class="profile-modal-field"><span>Nombre</span><input id="rename-profile-name" type="text" maxlength="40" value="${escapeProfileAttribute(profile.name)}" autocomplete="off"></label>
    <div class="modal-actions"><button class="secondary-button" data-profile-modal-close>Cancelar</button><button class="primary-button" data-profile-rename-save>Guardar</button></div>`);
  const input = overlay.querySelector<HTMLInputElement>('#rename-profile-name');
  window.setTimeout(() => { input?.focus(); input?.select(); }, 40);
  overlay.querySelector<HTMLButtonElement>('[data-profile-rename-save]')?.addEventListener('click', () => {
    const name = (input?.value ?? '').trim();
    if (!name) return;
    profile.name = name;
    profile.updatedAt = new Date().toISOString();
    persistProfiles();
    closeProfileModal();
    renderProfilesScreen();
  });
}

function openDeleteProfileModal(profile: TrainingProfile): void {
  if (profiles.length <= 1) return;
  closeProfileModal();
  const overlay = createProfileModal(`
    <h2>Eliminar perfil</h2>
    <p>Se eliminará “${escapeProfileHtml(profile.name)}” y todos los parámetros guardados dentro de ese perfil. El historial ya realizado no se borra.</p>
    <div class="modal-actions"><button class="secondary-button" data-profile-modal-close>Cancelar</button><button class="danger-button" data-profile-delete-confirm>Eliminar</button></div>`);
  overlay.querySelector<HTMLButtonElement>('[data-profile-delete-confirm]')?.addEventListener('click', () => {
    profiles = profiles.filter((item) => item.id !== profile.id);
    if (activeProfileId === profile.id) activeProfileId = profiles[0].id;
    persistProfiles();
    persistActiveProfile();
    closeProfileModal();
    renderProfilesScreen();
  });
}

function createProfileModal(content: string): HTMLElement {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay profile-modal-overlay';
  overlay.innerHTML = `<section class="app-modal profile-modal" role="dialog" aria-modal="true">${content}</section>`;
  document.body.appendChild(overlay);
  overlay.querySelectorAll<HTMLButtonElement>('[data-profile-modal-close]').forEach((button) => button.addEventListener('click', closeProfileModal));
  overlay.addEventListener('click', (event) => { if (event.target === overlay) closeProfileModal(); });
  return overlay;
}

function closeProfileModal(): void {
  document.querySelector('.profile-modal-overlay')?.remove();
}

async function clearLegacyPresets(): Promise<void> {
  if (localStorage.getItem(OLD_PRESETS_CLEARED_KEY) === '1' || typeof indexedDB === 'undefined') return;
  try {
    const db = await openExistingAppDb();
    if (db.objectStoreNames.contains(APP_DB_PRESET_STORE)) {
      await new Promise<void>((resolve) => {
        const transaction = db.transaction(APP_DB_PRESET_STORE, 'readwrite');
        transaction.objectStore(APP_DB_PRESET_STORE).clear();
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => resolve();
        transaction.onabort = () => resolve();
      });
    }
    db.close();
    localStorage.setItem(OLD_PRESETS_CLEARED_KEY, '1');
  } catch {
    // Migration cleanup is best-effort and must never block the app.
  }
}

async function tagLatestSessionWithProfile(): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  try {
    const db = await openExistingAppDb();
    if (!db.objectStoreNames.contains(APP_DB_SESSION_STORE)) {
      db.close();
      return;
    }
    const sessions = await readAllSessions(db);
    const latest = sessions.sort((a, b) => String(b.finishedAt ?? '').localeCompare(String(a.finishedAt ?? '')))[0];
    if (!latest || !latest.id || latest.id === lastTaggedSessionId) {
      db.close();
      return;
    }

    const finished = latest.finishedAt ? new Date(latest.finishedAt).getTime() : 0;
    if (finished && Math.abs(Date.now() - finished) > 30000) {
      db.close();
      return;
    }

    const profile = activeProfile();
    latest.profileId = profile.id;
    latest.profileName = profile.name;
    await putSession(db, latest);
    lastTaggedSessionId = latest.id;
    db.close();
  } catch {
    // Session tagging is metadata only; training/results must remain available.
  }
}

function openExistingAppDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(APP_DB_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function readAllSessions(db: IDBDatabase): Promise<SessionWithProfile[]> {
  return new Promise((resolve) => {
    const results: SessionWithProfile[] = [];
    const transaction = db.transaction(APP_DB_SESSION_STORE, 'readonly');
    const request = transaction.objectStore(APP_DB_SESSION_STORE).openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;
      results.push(cursor.value as SessionWithProfile);
      cursor.continue();
    };
    transaction.oncomplete = () => resolve(results);
    transaction.onerror = () => resolve(results);
    transaction.onabort = () => resolve(results);
  });
}

function putSession(db: IDBDatabase, session: SessionWithProfile): Promise<void> {
  return new Promise((resolve) => {
    const transaction = db.transaction(APP_DB_SESSION_STORE, 'readwrite');
    transaction.objectStore(APP_DB_SESSION_STORE).put(session);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => resolve();
    transaction.onabort = () => resolve();
  });
}

function escapeProfileHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  })[character] ?? character);
}

function escapeProfileAttribute(value: string): string {
  return escapeProfileHtml(value);
}
