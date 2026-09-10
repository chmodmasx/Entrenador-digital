const DECIMAL_STEPPER_IDS = new Set(['waitMin', 'waitMax', 'stimulusDuration']);

function stepperButtonFromTarget(target: EventTarget | null): HTMLButtonElement | null {
  if (!(target instanceof Element)) return null;
  const button = target.closest<HTMLButtonElement>('button[data-delta]');
  if (!button || !button.closest('[data-stepper]')) return null;
  return button;
}

function parseLocaleNumber(raw: string): number | null {
  const normalized = raw.trim().replace(/\s+/g, '').replace(',', '.');
  if (!/^-?(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized)) return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

function inputBound(input: HTMLInputElement, name: 'min' | 'max'): number | null {
  const raw = input.getAttribute(name);
  if (raw === null || raw === '') return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function formatStepperValue(value: number, input: HTMLInputElement): string {
  if (!DECIMAL_STEPPER_IDS.has(input.id)) return String(Math.round(value));
  return value
    .toFixed(2)
    .replace(/(\.\d*?[1-9])0+$/, '$1')
    .replace(/\.0+$/, '');
}

function normalizeStepperInput(input: HTMLInputElement, clampToBounds = true): number | null {
  let value = parseLocaleNumber(input.value);

  if (value === null) {
    const fallback = parseLocaleNumber(input.dataset.lastValid ?? '');
    if (fallback === null) return null;
    value = fallback;
  }

  const min = inputBound(input, 'min');
  const max = inputBound(input, 'max');
  if (clampToBounds) {
    if (min !== null) value = Math.max(min, value);
    if (max !== null) value = Math.min(max, value);
  }

  if (!DECIMAL_STEPPER_IDS.has(input.id)) value = Math.round(value);

  input.value = formatStepperValue(value, input);
  input.dataset.lastValid = input.value;
  return value;
}

function upgradeStepperInput(input: HTMLInputElement): void {
  if (input.dataset.localeStepper === 'true') return;

  // type="number" rejects values such as 0.85 when step="0.1" before our own
  // validation can run. A decimal text field gives us consistent behaviour on
  // Android WebView and lets both comma and point be accepted.
  input.dataset.localeStepper = 'true';
  input.dataset.lastValid = formatStepperValue(Number(input.value || 0), input);
  input.type = 'text';
  input.inputMode = DECIMAL_STEPPER_IDS.has(input.id) ? 'decimal' : 'numeric';
  input.autocomplete = 'off';
  input.spellcheck = false;

  input.addEventListener('blur', () => {
    normalizeStepperInput(input, true);
  });

  input.addEventListener('change', () => {
    normalizeStepperInput(input, true);
  });
}

function upgradeCurrentUi(root: ParentNode = document): void {
  root.querySelectorAll<HTMLInputElement>('.stepper-value input').forEach(upgradeStepperInput);
  root.querySelectorAll<HTMLFormElement>('#exercise-config').forEach((form) => {
    form.noValidate = true;
  });
}

function normalizeAllSteppers(): void {
  document.querySelectorAll<HTMLInputElement>('.stepper-value input').forEach((input) => {
    normalizeStepperInput(input, true);
  });
}

function applyButtonDelta(button: HTMLButtonElement): void {
  const stepper = button.closest<HTMLElement>('[data-stepper]');
  const input = stepper?.querySelector<HTMLInputElement>('.stepper-value input');
  if (!input) return;

  const delta = Number(button.dataset.delta ?? '0');
  if (!Number.isFinite(delta)) return;

  const current = normalizeStepperInput(input, true);
  if (current === null) return;

  const min = inputBound(input, 'min');
  const max = inputBound(input, 'max');
  let next = current + delta;
  if (min !== null) next = Math.max(min, next);
  if (max !== null) next = Math.min(max, next);

  // Preserve hundredths typed manually. +/- still advances by its configured
  // amount (normally 0.1 s), so 0.85 + 0.1 becomes 0.95 rather than 0.9.
  next = Math.round(next * 100) / 100;
  input.value = formatStepperValue(next, input);
  input.dataset.lastValid = input.value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

let heldButton: HTMLButtonElement | null = null;
let holdDelay: number | undefined;
let repeatTimer: number | undefined;
let holdStartedAt = 0;
let suppressClickButton: HTMLButtonElement | null = null;
let suppressClickUntil = 0;
let lastTouchAt = 0;

function clearHoldTimers(): void {
  if (holdDelay !== undefined) window.clearTimeout(holdDelay);
  if (repeatTimer !== undefined) window.clearTimeout(repeatTimer);
  holdDelay = undefined;
  repeatTimer = undefined;
}

function repeatHeldStepper(): void {
  if (!heldButton) return;
  applyButtonDelta(heldButton);
  const elapsed = Date.now() - holdStartedAt;
  const delay = elapsed > 1500 ? 60 : elapsed > 800 ? 90 : 125;
  repeatTimer = window.setTimeout(repeatHeldStepper, delay);
}

function beginStepperHold(button: HTMLButtonElement): void {
  clearHoldTimers();
  heldButton = button;
  holdStartedAt = Date.now();
  button.classList.add('is-pressing');
  applyButtonDelta(button);
  holdDelay = window.setTimeout(repeatHeldStepper, 360);
}

function endStepperHold(): void {
  if (!heldButton) return;
  const button = heldButton;
  clearHoldTimers();
  button.classList.remove('is-pressing');
  heldButton = null;
  suppressClickButton = button;
  suppressClickUntil = Date.now() + 600;
}

// Normalize decimal commas before the application reads the form values.
document.addEventListener('submit', (event) => {
  const form = event.target;
  if (form instanceof HTMLFormElement && form.id === 'exercise-config') {
    normalizeAllSteppers();
  }
}, true);

// If a +/- button is pressed while the field contains a comma, normalize it
// before calculating the delta. Capture phase deliberately supersedes the old
// per-button handler so there is a single source of truth for hold repetition.
if ('PointerEvent' in window) {
  document.addEventListener('pointerdown', (event) => {
    const button = stepperButtonFromTarget(event.target);
    if (!button || (event.button !== undefined && event.button !== 0)) return;
    event.preventDefault();
    event.stopPropagation();
    beginStepperHold(button);
  }, true);
  document.addEventListener('pointerup', endStepperHold, true);
  document.addEventListener('pointercancel', endStepperHold, true);
} else {
  document.addEventListener('touchstart', (event) => {
    const button = stepperButtonFromTarget(event.target);
    if (!button || event.touches.length !== 1) return;
    lastTouchAt = Date.now();
    event.preventDefault();
    event.stopPropagation();
    beginStepperHold(button);
  }, { capture: true, passive: false });
  document.addEventListener('touchend', endStepperHold, true);
  document.addEventListener('touchcancel', endStepperHold, true);
  document.addEventListener('mousedown', (event) => {
    if (Date.now() - lastTouchAt < 800) return;
    const button = stepperButtonFromTarget(event.target);
    if (!button || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    beginStepperHold(button);
  }, true);
  document.addEventListener('mouseup', endStepperHold, true);
  document.addEventListener('mouseleave', endStepperHold, true);
}

document.addEventListener('click', (event) => {
  const button = stepperButtonFromTarget(event.target);
  if (!button) return;

  event.preventDefault();
  event.stopImmediatePropagation();

  // Pointer/touch already applied the first step on press. Keyboard-generated
  // clicks have no preceding pointer press, so apply one step here.
  if (button === suppressClickButton && Date.now() <= suppressClickUntil) {
    suppressClickButton = null;
    suppressClickUntil = 0;
    return;
  }
  applyButtonDelta(button);
}, true);

document.addEventListener('contextmenu', (event) => {
  if (stepperButtonFromTarget(event.target)) event.preventDefault();
}, true);

document.addEventListener('DOMContentLoaded', () => {
  upgradeCurrentUi();
  if (!window.MutationObserver) return;
  new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of Array.from(mutation.addedNodes)) {
        if (node instanceof Element) upgradeCurrentUi(node);
      }
    }
  }).observe(document.body, { childList: true, subtree: true });
});
