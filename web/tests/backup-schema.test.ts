import { describe, expect, it } from 'vitest';
import { validateBackupPayload } from '../src/storage/backup-schema';

function validBackup() {
  return {
    format: 'entrenador-digital-backup',
    schemaVersion: 1,
    exportedAt: '2026-09-22T00:00:00.000Z',
    appVersion: '1.0.0',
    localStorage: {
      'entrenador-digital-settings-v1': '{}',
    },
    indexedDb: {
      name: 'entrenador-digital',
      stores: {
        sessions: [{ id: 'session-1' }],
        presets: [{ id: 'preset-1' }],
      },
    },
  };
}

describe('backup validation', () => {
  it('accepts a structurally valid backup', () => {
    const result = validateBackupPayload(validBackup());
    expect(result.indexedDb.stores.sessions).toHaveLength(1);
  });

  it('rejects unrelated localStorage keys', () => {
    const backup = validBackup();
    backup.localStorage = { unrelated: 'x' };
    expect(() => validateBackupPayload(backup)).toThrow();
  });

  it('rejects records without ids before storage is mutated', () => {
    const backup = validBackup();
    backup.indexedDb.stores.sessions = [{} as { id: string }];
    expect(() => validateBackupPayload(backup)).toThrow();
  });

  it('rejects unknown schema versions', () => {
    const backup = { ...validBackup(), schemaVersion: 99 };
    expect(() => validateBackupPayload(backup)).toThrow();
  });
});
