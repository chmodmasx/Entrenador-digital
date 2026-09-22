import type { StoredSession } from '../domain/session';
import { SESSION_STORE, clearStore, listRecords, putRecord } from './database';

export async function saveSession(session: StoredSession): Promise<void> {
  await putRecord(SESSION_STORE, session);
}

export async function listSessions(): Promise<StoredSession[]> {
  const values = await listRecords<StoredSession>(SESSION_STORE);
  return values.sort((a, b) => b.finishedAt.localeCompare(a.finishedAt));
}

export async function clearSessions(): Promise<void> {
  await clearStore(SESSION_STORE);
}
