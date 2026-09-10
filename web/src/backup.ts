export {};

type NativeBackupBridge = {
  saveBackup?: (json: string, suggestedName: string) => void;
  openBackup?: () => void;
  getAppVersion?: () => string;
};

declare global {
  interface Window {
    __ENTRENADOR_IMPORT_BACKUP?: (raw: string) => void;
  }
}

interface BackupPayload {
  format: 'entrenador-digital-backup';
  schemaVersion: 1;
  exportedAt: string;
  appVersion: string;
  localStorage: Record<string, string>;
  indexedDb: {
    name: 'entrenador-digital';
    stores: Record<string, unknown[]>;
  };
}

const DB_NAME = 'entrenador-digital';
const BACKUP_STORES = ['sessions', 'presets'];
const APP_STORAGE_PREFIX = 'entrenador-digital-';
const app = document.querySelector<HTMLDivElement>('#app');

function nativeBridge(): NativeBackupBridge | undefined {
  return (window as unknown as { Android?: NativeBackupBridge }).Android;
}

if (app) {
  const observer = new MutationObserver(() => window.setTimeout(enhanceSettingsBackup, 0));
  observer.observe(app, { childList: true, subtree: true });
  window.setTimeout(enhanceSettingsBackup, 0);
}

window.__ENTRENADOR_IMPORT_BACKUP = (raw: string): void => {
  void importBackupPayload(raw);
};

function enhanceSettingsBackup(): void {
  const settings = app?.querySelector<HTMLElement>('.settings-screen');
  if (!settings) return;

  const dataTitle = Array.from(settings.querySelectorAll<HTMLElement>('.section-title h2'))
    .find((heading) => heading.textContent?.trim() === 'Datos locales');
  const card = dataTitle?.closest<HTMLElement>('.settings-card');
  const title = dataTitle?.closest<HTMLElement>('.section-title');
  if (!card || !title || card.dataset.backupEnhanced === 'true') return;

  card.dataset.backupEnhanced = 'true';

  const exportButton = document.createElement('button');
  exportButton.type = 'button';
  exportButton.className = 'settings-action-row';
  exportButton.dataset.action = 'export-backup';
  exportButton.innerHTML = '<span><strong>Exportar copia de seguridad</strong><small>Guarda perfiles, ajustes e historial en un archivo JSON</small></span><b>›</b>';

  const importButton = document.createElement('button');
  importButton.type = 'button';
  importButton.className = 'settings-action-row';
  importButton.dataset.action = 'import-backup';
  importButton.innerHTML = '<span><strong>Importar copia de seguridad</strong><small>Restaura datos guardados anteriormente</small></span><b>›</b>';

  title.after(exportButton, importButton);

  exportButton.addEventListener('click', () => void exportBackup());
  importButton.addEventListener('click', () => {
    const native = nativeBridge();
    if (!native?.openBackup) {
      window.alert('La importación de copias está disponible en la aplicación Android.');
      return;
    }

    const confirmed = window.confirm(
      'La importación reemplazará los perfiles, ajustes e historial actuales. ¿Querés continuar?'
    );
    if (confirmed) native.openBackup();
  });
}

async function exportBackup(): Promise<void> {
  try {
    const payload = await collectBackup();
    const json = JSON.stringify(payload, null, 2);
    const date = new Date().toISOString().slice(0, 10);
    const fileName = `Entrenador-Digital-backup-${date}.json`;
    const native = nativeBridge();

    if (native?.saveBackup) {
      native.saveBackup(json, fileName);
      return;
    }

    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 2_000);
  } catch (error) {
    console.error('No se pudo exportar la copia', error);
    window.alert('No se pudo crear la copia de seguridad.');
  }
}

async function collectBackup(): Promise<BackupPayload> {
  const storage: Record<string, string> = {};
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key) continue;
    const value = localStorage.getItem(key);
    if (value !== null) storage[key] = value;
  }

  const stores: Record<string, unknown[]> = {};
  const db = await openDatabase();
  try {
    for (const storeName of BACKUP_STORES) {
      stores[storeName] = db.objectStoreNames.contains(storeName)
        ? await readAll(db, storeName)
        : [];
    }
  } finally {
    db.close();
  }

  return {
    format: 'entrenador-digital-backup',
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    appVersion: nativeBridge()?.getAppVersion?.() ?? 'web',
    localStorage: storage,
    indexedDb: {
      name: DB_NAME,
      stores,
    },
  };
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('No se pudo abrir la base local'));
  });
}

function readAll(db: IDBDatabase, storeName: string): Promise<unknown[]> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const values: unknown[] = [];
    const cursor = store.openCursor();

    cursor.onsuccess = () => {
      const current = cursor.result;
      if (!current) return;
      values.push(current.value);
      current.continue();
    };
    cursor.onerror = () => reject(cursor.error ?? new Error(`No se pudo leer ${storeName}`));
    transaction.oncomplete = () => resolve(values);
    transaction.onerror = () => reject(transaction.error ?? new Error(`No se pudo leer ${storeName}`));
    transaction.onabort = () => reject(transaction.error ?? new Error(`Lectura cancelada en ${storeName}`));
  });
}

async function importBackupPayload(raw: string): Promise<void> {
  try {
    const parsed = JSON.parse(raw) as Partial<BackupPayload>;
    if (
      parsed.format !== 'entrenador-digital-backup' ||
      parsed.schemaVersion !== 1 ||
      !parsed.localStorage ||
      typeof parsed.localStorage !== 'object' ||
      !parsed.indexedDb ||
      parsed.indexedDb.name !== DB_NAME ||
      !parsed.indexedDb.stores ||
      typeof parsed.indexedDb.stores !== 'object'
    ) {
      throw new Error('Formato de copia no reconocido');
    }

    await restoreIndexedDb(parsed.indexedDb.stores as Record<string, unknown[]>);
    restoreLocalStorage(parsed.localStorage as Record<string, string>);

    window.alert('Copia de seguridad restaurada correctamente. La app se reiniciará para aplicar los datos.');
    window.location.reload();
  } catch (error) {
    console.error('No se pudo importar la copia', error);
    window.alert('No se pudo importar la copia. Verificá que sea un archivo válido de Entrenador Digital.');
  }
}

function restoreLocalStorage(values: Record<string, string>): void {
  const keysToRemove: string[] = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key?.startsWith(APP_STORAGE_PREFIX)) keysToRemove.push(key);
  }
  keysToRemove.forEach((key) => localStorage.removeItem(key));

  Object.entries(values).forEach(([key, value]) => {
    if (key.startsWith(APP_STORAGE_PREFIX) && typeof value === 'string') {
      localStorage.setItem(key, value);
    }
  });
}

async function restoreIndexedDb(stores: Record<string, unknown[]>): Promise<void> {
  const db = await openDatabase();
  try {
    for (const storeName of BACKUP_STORES) {
      if (!db.objectStoreNames.contains(storeName)) continue;
      const records = Array.isArray(stores[storeName]) ? stores[storeName] : [];
      await replaceStore(db, storeName, records);
    }
  } finally {
    db.close();
  }
}

function replaceStore(db: IDBDatabase, storeName: string, records: unknown[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    store.clear();
    records.forEach((record) => store.put(record));

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error(`No se pudo restaurar ${storeName}`));
    transaction.onabort = () => reject(transaction.error ?? new Error(`Restauración cancelada en ${storeName}`));
  });
}
