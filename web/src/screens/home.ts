import { cognitiveCardVisual } from '../cognitive-games';
import { EXERCISE_META, type ExerciseId } from '../domain/exercises';

export interface HomeScreenActions {
  onConfigure: (exercise: ExerciseId) => void;
  onQuickStart: (exercise: ExerciseId) => void;
  onHistory: () => void;
  onSettings: () => void;
}

function icon(name: 'history' | 'settings'): string {
  const icons = {
    history: '<svg viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 2"/></svg>',
    settings: '<svg viewBox="0 0 24 24"><path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/></svg>',
  };
  return icons[name];
}

function exerciseCard(id: ExerciseId, visual: string): string {
  const meta = EXERCISE_META[id];
  return `
    <article class="exercise-card-wrap">
      <button class="exercise-card" data-exercise="${id}">
        <span class="exercise-visual">${visual}</span>
        <strong>${meta.title}</strong>
        <small>${meta.subtitle}</small>
      </button>
      <button class="exercise-quick-start" type="button" data-quick-start="${id}" aria-label="Iniciar ${meta.title} con el perfil activo">▶</button>
    </article>`;
}

function bindCarousel(root: HTMLElement): void {
  const carousel = root.querySelector<HTMLDivElement>('#exercise-carousel');
  if (!carousel) return;
  const pages = Array.from(carousel.querySelectorAll<HTMLElement>('[data-exercise-page]'));
  const dots = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-carousel-page]'));
  let frame = 0;

  const targetLeft = (page: HTMLElement): number => {
    const centered = page.offsetLeft - (carousel.clientWidth - page.clientWidth) / 2;
    const maximum = Math.max(0, carousel.scrollWidth - carousel.clientWidth);
    return Math.max(0, Math.min(maximum, centered));
  };

  const setActive = (index: number) => {
    const activeIndex = Math.max(0, Math.min(pages.length - 1, index));
    dots.forEach((dot, dotIndex) => {
      const active = dotIndex === activeIndex;
      dot.classList.toggle('is-active', active);
      if (active) dot.setAttribute('aria-current', 'true');
      else dot.removeAttribute('aria-current');
    });
  };

  const closestPageIndex = (): number => {
    let closestIndex = 0;
    let closestDistance = Number.POSITIVE_INFINITY;
    pages.forEach((page, index) => {
      const distance = Math.abs(carousel.scrollLeft - targetLeft(page));
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = index;
      }
    });
    return closestIndex;
  };

  carousel.addEventListener('scroll', () => {
    if (frame) cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => setActive(closestPageIndex()));
  }, { passive: true });

  dots.forEach((dot) => {
    dot.addEventListener('click', () => {
      const index = Math.max(0, Math.min(pages.length - 1, Number(dot.dataset.carouselPage ?? 0)));
      const page = pages[index];
      if (!page) return;
      carousel.scrollTo({ left: targetLeft(page), behavior: 'smooth' });
      setActive(index);
    });
  });
}

export function mountHomeScreen(root: HTMLElement, actions: HomeScreenActions): void {
  root.innerHTML = `
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

      <div class="exercise-carousel-shell">
        <div class="exercise-carousel-dots" aria-label="Páginas de ejercicios">
          <button type="button" class="exercise-carousel-dot is-active" data-carousel-page="0" aria-label="Página 1" aria-current="true"></button>
          <button type="button" class="exercise-carousel-dot" data-carousel-page="1" aria-label="Página 2"></button>
          <button type="button" class="exercise-carousel-dot" data-carousel-page="2" aria-label="Página 3"></button>
        </div>
        <div class="exercise-carousel" id="exercise-carousel">
          <section class="exercise-grid exercise-page" data-exercise-page="0" aria-label="Ejercicios, página 1">
            ${exerciseCard('arrows', '<span class="exercise-arrow">➜</span>')}
            ${exerciseCard('numbers', '<span class="exercise-numbers">1·2·3</span>')}
            ${exerciseCard('colors', '<span class="color-dots"><i></i><i></i><i></i></span>')}
            ${exerciseCard('color-number', '<span class="mixed-icon"><b>7</b><i></i><i></i></span>')}
          </section>
          <section class="exercise-grid exercise-page" data-exercise-page="1" aria-label="Ejercicios, página 2">
            ${exerciseCard('stroop', '<span class="letter-blocks"><b>A</b><b>B</b></span>')}
            ${exerciseCard('words', '<span class="word-icon">≡</span>')}
            ${exerciseCard('flow', cognitiveCardVisual('flow'))}
            ${exerciseCard('memory-match', cognitiveCardVisual('memory-match'))}
          </section>
          <section class="exercise-grid exercise-page" data-exercise-page="2" aria-label="Ejercicios, página 3">
            ${exerciseCard('memory-matrix', cognitiveCardVisual('memory-matrix'))}
            ${exerciseCard('spatial-match', cognitiveCardVisual('spatial-match'))}
            ${exerciseCard('star-search', cognitiveCardVisual('star-search'))}
            ${exerciseCard('rule-shift', cognitiveCardVisual('rule-shift'))}
          </section>
        </div>
      </div>

      <nav class="home-shortcuts" aria-label="Accesos rápidos">
        <button class="shortcut-card" data-action="history">
          <span class="shortcut-icon">${icon('history')}</span>
          <span><strong>Historial</strong><small>Sesiones realizadas</small></span>
        </button>
        <button class="shortcut-card" data-action="settings">
          <span class="shortcut-icon">${icon('settings')}</span>
          <span><strong>Ajustes</strong><small>Experiencia de entrenamiento</small></span>
        </button>
      </nav>

      <p class="home-motto"><span></span> DISCIPLINA HOY, REFLEJOS MAÑANA <span></span></p>
    </main>`;

  root.querySelectorAll<HTMLButtonElement>('[data-exercise]').forEach((button) => {
    button.addEventListener('click', () => actions.onConfigure(button.dataset.exercise as ExerciseId));
  });
  root.querySelectorAll<HTMLButtonElement>('[data-quick-start]').forEach((button) => {
    button.addEventListener('click', () => actions.onQuickStart(button.dataset.quickStart as ExerciseId));
  });
  root.querySelector<HTMLButtonElement>('[data-action="history"]')?.addEventListener('click', actions.onHistory);
  root.querySelector<HTMLButtonElement>('[data-action="settings"]')?.addEventListener('click', actions.onSettings);
  bindCarousel(root);
}
