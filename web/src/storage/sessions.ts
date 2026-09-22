import type { StoredSession } from '../domain/session';
import { SESSION_STORE, clearStore, listRecords, putRecord } from './database';

export async function saveSession(session: StoredSession): Promise<void> {
  try {
    await putRecord(SESSION_STORE, session);
  } catch (error) {
    console.error('No se pudo guardar la sesión', error);
  }
}

export async function listSessions(): Promise<StoredSession[]> {
  try {
    const values = await listRecords<StoredSession>(SESSION_STORE);
    return values.sort((a, b) => b.finishedAt.localeCompare(a.finishedAt));
  } catch (error) {
    console.error('No se pudo leer el historial', error);
    return [];
  }
}

export async function clearSessions(): Promise<void> {
  try {
    await clearStore(SESSION_STORE);
  } catch (error) {
    console.error('No se pudo borrar el historial', error);
  }
}
