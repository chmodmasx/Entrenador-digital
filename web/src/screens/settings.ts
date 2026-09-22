import type { AppSettings } from '../domain/settings';

export interface SettingsScreenActions {
  onBack: () => void;
  onChange: (key: keyof AppSettings, enabled: boolean) => void;
  onExportBackup: () => void;
  onImportBackup: () => void;
  onClearHistory: () => void;
  onCheckUpdates: () => void;
}

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

export function mountSettingsScreen(
  root: HTMLElement,
  settings: AppSettings,
  version: string,
  actions: SettingsScreenActions,
): void {
  root.innerHTML = `
    <main class="app-shell settings-screen">
      <header class="topbar">
        <button class="icon-button" data-action="back" aria-label="Volver">←</button>
        <div><h1>Ajustes</h1><p>Personaliza la experiencia de entrenamiento</p></div>
        <div class="topbar-spacer"></div>
      </header>

      <section class="settings-card settings-list-card">
        <div class="section-title"><span>ϟ</span><div><h2>Durante el entrenamiento</h2><p>Se aplica a todos los modos</p></div></div>
        ${toggleRow('setting-countdown', 'Cuenta regresiva', 'Mostrar 3, 2, 1 y “¡Ya!” antes de comenzar', settings.countdown)}
        ${toggleRow('setting-progress', 'Mostrar progreso', 'Ver cantidad de estímulos completados', settings.showProgress)}
        ${toggleRow('setting-sound', 'Sonido de señal', 'Emitir un tono breve cuando aparece el estímulo', settings.sound)}
        ${toggleRow('setting-vibration', 'Vibración', 'Vibrar brevemente cuando aparece el estímulo', settings.vibration)}
      </section>

      <section class="settings-card settings-list-card">
        <div class="section-title"><span>↻</span><div><h2>Aplicación</h2><p>Versión instalada y actualizaciones</p></div></div>
        <button class="settings-action-row" data-action="check-updates"><span><strong>Buscar actualizaciones</strong><small>Versión instalada ${escapeHtml(version)} · consulta la última release disponible</small></span><b>›</b></button>
      </section>

      <section class="settings-card settings-list-card" data-settings-data>
        <div class="section-title"><span>⌁</span><div><h2>Datos locales</h2><p>Todo permanece guardado solamente en este dispositivo</p></div></div>
        <button class="settings-action-row" data-action="export-backup"><span><strong>Exportar copia de seguridad</strong><small>Guarda perfiles, ajustes e historial en un archivo JSON</small></span><b>›</b></button>
        <button class="settings-action-row" data-action="import-backup"><span><strong>Importar copia de seguridad</strong><small>Restaura datos guardados anteriormente</small></span><b>›</b></button>
        <button class="settings-action-row" data-action="clear-history"><span><strong>Borrar historial</strong><small>Elimina todas las sesiones guardadas</small></span><b>›</b></button>
      </section>

      <section class="about-card">
        <div class="brand-mark about-brand">ϟ</div>
        <div><strong>Entrenador Digital</strong><span>Versión ${escapeHtml(version)}</span><small>Aplicación local y offline. Sin cuentas, nube ni telemetría.</small></div>
      </section>
    </main>`;

  root.querySelector<HTMLButtonElement>('[data-action="back"]')?.addEventListener('click', actions.onBack);

  const bindings: Array<[string, keyof AppSettings]> = [
    ['setting-countdown', 'countdown'],
    ['setting-progress', 'showProgress'],
    ['setting-sound', 'sound'],
    ['setting-vibration', 'vibration'],
  ];
  bindings.forEach(([id, key]) => {
    root.querySelector<HTMLInputElement>(`#${id}`)?.addEventListener('change', (event) => {
      actions.onChange(key, (event.currentTarget as HTMLInputElement).checked);
    });
  });

  root.querySelector<HTMLButtonElement>('[data-action="check-updates"]')?.addEventListener('click', actions.onCheckUpdates);
  root.querySelector<HTMLButtonElement>('[data-action="export-backup"]')?.addEventListener('click', actions.onExportBackup);
  root.querySelector<HTMLButtonElement>('[data-action="import-backup"]')?.addEventListener('click', actions.onImportBackup);
  root.querySelector<HTMLButtonElement>('[data-action="clear-history"]')?.addEventListener('click', actions.onClearHistory);
}
