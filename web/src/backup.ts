import { nativeBridge } from './platform/native-bridge';
import { DB_NAME, PRESET_STORE, SESSION_STORE, openDatabase } from './storage/database';
import {
  APP_STORAGE_PREFIX,
  BACKUP_FORMAT,
  BACKUP_SCHEMA_VERSION,
  parseBackup,
  type BackupPayload,
} from './storage/backup-schema';

declare global {
  interface Window {
    __ENTRENADOR_IMPORT_BACKUP?: (raw: string) => void;
  }
}

const BACKUP_STORES = [SESSION_STORE, PRESET_STORE] as const;


window.__ENTRENADOR_IMPORT_BACKUP = (raw: string): void => {
  void importBackupPayload(raw);
};

export function requestBackupImport(): void {
  const native = nativeBridge();
  if (!native?.openBackup) {
    window.alert('La importación de copias está disponible en la aplicación Android.');
    return;
  }

  const confirmed = window.confirm(
    'La importación reemplazará los perfiles, ajustes e historial actuales. ¿Querés continuar?'
  );
  if (confirmed) native.openBackup();
}

export async function exportBackup(): Promise<void> {
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
    format: BACKUP_FORMAT,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    appVersion: nativeBridge()?.getAppVersion?.() ?? 'web',
    localStorage: storage,
    indexedDb: {
      name: DB_NAME,
      stores,
    },
  };
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
    const parsed = parseBackup(raw);
    const previousStorage = snapshotAppLocalStorage();
    const previousStores = await snapshotStores();

    try {
      await restoreIndexedDb(parsed.indexedDb.stores);
      restoreLocalStorage(parsed.localStorage);
    } catch (restoreError) {
      await restoreIndexedDb(previousStores).catch(() => undefined);
      restoreLocalStorage(previousStorage);
      throw restoreError;
    }

    window.alert('Copia de seguridad restaurada correctamente. La app se reiniciará para aplicar los datos.');
    window.location.reload();
  } catch (error) {
    console.error('No se pudo importar la copia', error);
    window.alert('No se pudo importar la copia. Verificá que sea un archivo válido de Entrenador Digital.');
  }
}

function snapshotAppLocalStorage(): Record<string, string> {
  const values: Record<string, string> = {};
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key?.startsWith(APP_STORAGE_PREFIX)) continue;
    const value = localStorage.getItem(key);
    if (value !== null) values[key] = value;
  }
  return values;
}

async function snapshotStores(): Promise<Record<string, unknown[]>> {
  const db = await openDatabase();
  try {
    const stores: Record<string, unknown[]> = {};
    for (const storeName of BACKUP_STORES) {
      stores[storeName] = db.objectStoreNames.contains(storeName) ? await readAll(db, storeName) : [];
    }
    return stores;
  } finally {
    db.close();
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
    const storeNames = BACKUP_STORES.filter((storeName) => db.objectStoreNames.contains(storeName));
    if (!storeNames.length) return;

    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(storeNames, 'readwrite');
      for (const storeName of storeNames) {
        const store = transaction.objectStore(storeName);
        store.clear();
        const records = Array.isArray(stores[storeName]) ? stores[storeName] : [];
        records.forEach((record) => store.put(record));
      }

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('No se pudo restaurar la base local'));
      transaction.onabort = () => reject(transaction.error ?? new Error('Restauración cancelada'));
    });
  } finally {
    db.close();
  }
}
