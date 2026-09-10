export {};

const RETURN_EXERCISE_KEY = 'entrenador-digital-profile-return-exercise-v1';
const RETURN_SCROLL_KEY = 'entrenador-digital-profile-return-scroll-v1';

const app = document.querySelector<HTMLDivElement>('#app');

type ExerciseId = 'arrows' | 'numbers' | 'colors' | 'color-number' | 'stroop' | 'words';

const exerciseByTitle: Record<string, ExerciseId> = {
  Flechas: 'arrows',
  Números: 'numbers',
  Colores: 'colors',
  'Color + número': 'color-number',
  'Color y palabra': 'stroop',
  Palabras: 'words',
};

if (app) {
  const observer = new MutationObserver(() => {
    enhanceProfileContext();
    resumeConfigurationAfterProfiles();
  });

  observer.observe(app, { childList: true, subtree: true });
  window.setTimeout(() => {
    enhanceProfileContext();
    resumeConfigurationAfterProfiles();
  }, 0);
}

function enhanceProfileContext(): void {
  if (!app) return;
  const context = app.querySelector<HTMLElement>('.config-screen [data-profile-context]');
  if (!context) return;

  context.dataset.profileContextLink = 'true';
  context.setAttribute('role', 'button');
  context.setAttribute('tabindex', '0');

  const profileName = context.querySelector<HTMLElement>('strong')?.textContent?.trim() ?? 'activo';
  context.setAttribute('aria-label', `Abrir perfiles. Perfil activo: ${profileName}`);

  if (context.dataset.profileContextBound === 'true') return;
  context.dataset.profileContextBound = 'true';

  context.addEventListener('click', openProfilesFromConfiguration);
  context.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    openProfilesFromConfiguration();
  });
}

function openProfilesFromConfiguration(): void {
  if (!app) return;
  const configScreen = app.querySelector<HTMLElement>('.config-screen');
  if (!configScreen || app.querySelector('.profiles-screen-v2')) return;

  const title = configScreen.querySelector<HTMLElement>('.topbar h1')?.textContent?.trim() ?? '';
  const exercise = exerciseByTitle[title];
  if (exercise) {
    sessionStorage.setItem(RETURN_EXERCISE_KEY, exercise);
    sessionStorage.setItem(RETURN_SCROLL_KEY, String(Math.max(0, window.scrollY)));
  }

  const activeElement = document.activeElement;
  if (activeElement instanceof HTMLElement) activeElement.blur();

  /* profiles.ts already owns the Profiles screen. Its compatibility hook opens
     that same screen whenever the legacy presets screen appears. Adding a hidden
     sentinel lets this shortcut reuse the exact same profile manager instead of
     duplicating navigation or profile state. */
  const sentinel = document.createElement('span');
  sentinel.className = 'presets-screen profile-navigation-sentinel';
  sentinel.hidden = true;
  app.appendChild(sentinel);
}

function resumeConfigurationAfterProfiles(): void {
  if (!app) return;
  const exercise = sessionStorage.getItem(RETURN_EXERCISE_KEY) as ExerciseId | null;
  if (!exercise) return;

  const home = app.querySelector<HTMLElement>('.home-screen');
  if (!home) return;

  const button = home.querySelector<HTMLButtonElement>(`[data-exercise="${exercise}"]`);
  if (!button) return;

  const scrollValue = Number(sessionStorage.getItem(RETURN_SCROLL_KEY) ?? '0');
  sessionStorage.removeItem(RETURN_EXERCISE_KEY);
  sessionStorage.removeItem(RETURN_SCROLL_KEY);

  button.click();

  if (Number.isFinite(scrollValue) && scrollValue > 0) {
    window.setTimeout(() => window.scrollTo(0, scrollValue), 80);
  }
}
