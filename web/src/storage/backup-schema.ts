import { DB_NAME, PRESET_STORE, SESSION_STORE } from './database';

export const BACKUP_FORMAT = 'entrenador-digital-backup' as const;
export const BACKUP_SCHEMA_VERSION = 1 as const;
export const APP_STORAGE_PREFIX = 'entrenador-digital-';

export interface BackupPayload {
  format: typeof BACKUP_FORMAT;
  schemaVersion: typeof BACKUP_SCHEMA_VERSION;
  exportedAt: string;
  appVersion: string;
  localStorage: Record<string, string>;
  indexedDb: {
    name: typeof DB_NAME;
    stores: Record<string, unknown[]>;
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function validateStoreRecords(name: string, value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new Error(`El store ${name} no es válido`);
  value.forEach((record) => {
    if (!isRecord(record) || typeof record.id !== 'string' || !record.id) {
      throw new Error(`El store ${name} contiene un registro inválido`);
    }
  });
  return value;
}

export function validateBackupPayload(value: unknown): BackupPayload {
  if (!isRecord(value)) throw new Error('Formato de copia no reconocido');
  if (value.format !== BACKUP_FORMAT || value.schemaVersion !== BACKUP_SCHEMA_VERSION) {
    throw new Error('Versión de copia no compatible');
  }
  if (!isRecord(value.localStorage) || !isRecord(value.indexedDb)) {
    throw new Error('La copia no contiene datos válidos');
  }
  if (value.indexedDb.name !== DB_NAME || !isRecord(value.indexedDb.stores)) {
    throw new Error('La base de datos de la copia no es válida');
  }

  const localStorageValues: Record<string, string> = {};
  Object.entries(value.localStorage).forEach(([key, stored]) => {
    if (!key.startsWith(APP_STORAGE_PREFIX) || typeof stored !== 'string') {
      throw new Error('La copia contiene una entrada de almacenamiento no válida');
    }
    localStorageValues[key] = stored;
  });

  const stores: Record<string, unknown[]> = {
    [SESSION_STORE]: validateStoreRecords(SESSION_STORE, value.indexedDb.stores[SESSION_STORE] ?? []),
    [PRESET_STORE]: validateStoreRecords(PRESET_STORE, value.indexedDb.stores[PRESET_STORE] ?? []),
  };

  return {
    format: BACKUP_FORMAT,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: typeof value.exportedAt === 'string' ? value.exportedAt : new Date(0).toISOString(),
    appVersion: typeof value.appVersion === 'string' ? value.appVersion : 'unknown',
    localStorage: localStorageValues,
    indexedDb: { name: DB_NAME, stores },
  };
}

export function parseBackup(raw: string): BackupPayload {
  return validateBackupPayload(JSON.parse(raw) as unknown);
}
