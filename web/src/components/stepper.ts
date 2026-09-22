const DECIMAL_IDS = new Set(['waitMin', 'waitMax', 'roundPause', 'stimulusDuration']);

export function parseLocaleNumber(raw: string): number | null {
  const normalized = raw.trim().replace(/\s+/g, '').replace(',', '.');
  if (!/^-?(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized)) return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

function decimalsForStep(step: number): number {
  const text = String(step);
  return text.includes('.') ? Math.min(4, text.split('.')[1]?.length ?? 0) : 0;
}

function formatValue(value: number, step: number): string {
  const decimals = Math.max(decimalsForStep(step), 0);
  if (!decimals) return String(Math.round(value));
  return value.toFixed(Math.max(2, decimals)).replace(/(\.\d*?[1-9])0+$/, '$1').replace(/\.0+$/, '');
}

function bound(input: HTMLInputElement, name: 'min' | 'max'): number | null {
  const raw = input.getAttribute(name);
  if (raw === null || raw === '') return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function stepOf(input: HTMLInputElement): number {
  const value = Number(input.getAttribute('step') ?? '1');
  return Number.isFinite(value) && value > 0 ? value : 1;
}

export function normalizeStepperInput(input: HTMLInputElement, clamp = true): number | null {
  let value = parseLocaleNumber(input.value);
  if (value === null) value = parseLocaleNumber(input.dataset.lastValid ?? '');
  if (value === null) return null;

  if (clamp) {
    const min = bound(input, 'min');
    const max = bound(input, 'max');
    if (min !== null) value = Math.max(min, value);
    if (max !== null) value = Math.min(max, value);
  }

  const step = stepOf(input);
  if (!DECIMAL_IDS.has(input.id) && step >= 1) value = Math.round(value);
  value = Math.round(value * 10000) / 10000;
  input.value = formatValue(value, step);
  input.dataset.lastValid = input.value;
  return value;
}

export function renderStepper(
  name: string,
  label: string,
  value: number,
  unit: string,
  min: number,
  max: number,
  step: number,
): string {
  const inputMode = step < 1 ? 'decimal' : 'numeric';
  return `
    <div class="setting-row">
      <label for="${name}">${label}</label>
      <div class="stepper" data-stepper="${name}">
        <button type="button" data-delta="-${step}" aria-label="Disminuir ${label}">−</button>
        <div class="stepper-value">
          <input id="${name}" name="${name}" type="text" value="${value}" min="${min}" max="${max}" step="${step}" inputmode="${inputMode}" autocomplete="off" spellcheck="false" />
          ${unit ? `<span>${unit}</span>` : ''}
        </div>
        <button type="button" data-delta="${step}" aria-label="Aumentar ${label}">+</button>
      </div>
    </div>`;
}

export function bindSteppers(root: ParentNode): void {
  const supportsPointer = 'PointerEvent' in window;

  root.querySelectorAll<HTMLElement>('[data-stepper]').forEach((stepperElement) => {
    if (stepperElement.dataset.stepperBound === 'true') return;
    stepperElement.dataset.stepperBound = 'true';

    const input = stepperElement.querySelector<HTMLInputElement>('.stepper-value input');
    if (!input) return;
    input.dataset.lastValid = input.value;
    input.addEventListener('blur', () => { normalizeStepperInput(input, true); });
    input.addEventListener('change', () => { normalizeStepperInput(input, true); });

    const applyDelta = (delta: number) => {
      const current = normalizeStepperInput(input, true);
      if (current === null) return;
      const min = bound(input, 'min');
      const max = bound(input, 'max');
      let next = current + delta;
      if (min !== null) next = Math.max(min, next);
      if (max !== null) next = Math.min(max, next);
      next = Math.round(next * 10000) / 10000;
      input.value = formatValue(next, Math.abs(delta) || stepOf(input));
      input.dataset.lastValid = input.value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    };

    stepperElement.querySelectorAll<HTMLButtonElement>('button[data-delta]').forEach((button) => {
      let holdDelay: number | undefined;
      let repeatTimer: number | undefined;
      let startedAt = 0;
      let pressHandled = false;
      const delta = Number(button.dataset.delta ?? 0);

      const clearTimers = () => {
        if (holdDelay !== undefined) window.clearTimeout(holdDelay);
        if (repeatTimer !== undefined) window.clearTimeout(repeatTimer);
        holdDelay = undefined;
        repeatTimer = undefined;
        button.classList.remove('is-pressing');
      };

      const repeat = () => {
        applyDelta(delta);
        const elapsed = Date.now() - startedAt;
        repeatTimer = window.setTimeout(repeat, elapsed > 1500 ? 60 : elapsed > 800 ? 90 : 125);
      };

      const start = (event: Event) => {
        event.preventDefault();
        clearTimers();
        pressHandled = true;
        startedAt = Date.now();
        button.classList.add('is-pressing');
        applyDelta(delta);
        holdDelay = window.setTimeout(repeat, 360);
      };

      button.addEventListener('click', (event) => {
        if (pressHandled) {
          pressHandled = false;
          event.preventDefault();
          return;
        }
        applyDelta(delta);
      });

      if (supportsPointer) {
        button.addEventListener('pointerdown', start);
        button.addEventListener('pointerup', clearTimers);
        button.addEventListener('pointercancel', clearTimers);
        button.addEventListener('pointerleave', clearTimers);
      } else {
        button.addEventListener('touchstart', start, { passive: false });
        button.addEventListener('touchend', clearTimers);
        button.addEventListener('touchcancel', clearTimers);
        button.addEventListener('mousedown', start);
        button.addEventListener('mouseup', clearTimers);
        button.addEventListener('mouseleave', clearTimers);
      }
    });
  });
}
