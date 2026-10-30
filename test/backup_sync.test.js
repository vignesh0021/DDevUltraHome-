import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { DatabaseConnection } from '../src/database/connection.js';
import { MigrationRunner } from '../src/database/migrationRunner.js';
import { SyncService } from '../src/services/syncService.js';

describe('DDevUltraHome Backup & Cloud Synchronization Service', () => {
  let db;
  let runner;
  let syncService;
  let tempDir;

  beforeEach(() => {
    db = new DatabaseConnection(':memory:');
    runner = new MigrationRunner(db);
    runner.migrate();

    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ddev-backup-test-'));
    syncService = new SyncService(db, tempDir);

    // Seed a sample client and project
    db.run(`
      INSERT INTO clients (id, name, phone, email, billing_address)
      VALUES ('client-bk1', 'Arunachalam & Co', '+91 98401 22334', 'arun@example.com', 'T Nagar, Chennai');
    `);

    db.run(`
      INSERT INTO projects (id, client_id, name, project_code, site_address, district, status)
      VALUES ('prj-bk1', 'client-bk1', 'Commercial Complex T Nagar', 'PRJ-TNR-01', 'T Nagar, Chennai', 'Chennai', 'ACTIVE');
    `);
  });

  afterEach(() => {
    if (db) db.close();
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('rule: generates immutable backup snapshot with SHA-256 hash and metadata', () => {
    const snapshot = syncService.generateBackupSnapshot();

    assert.ok(snapshot.payload);
    assert.equal(snapshot.payload.meta.app, 'DDevUltraHome');
    assert.equal(snapshot.payload.meta.company, 'D DEV ULTRA HOMES');
    assert.ok(snapshot.dataHash.length === 64, 'SHA-256 hash has 64 hex characters');
    assert.ok(snapshot.payload.data.projects.length >= 1);
    assert.ok(snapshot.payload.data.projects.some(p => p.project_code === 'PRJ-TNR-01'));
    assert.ok(snapshot.payload.data.projects.some(p => p.project_code === 'PRJ-KUN-2026'));
  });

  test('rule: exports backup to local JSON file with file size and hash integrity', () => {
    const exportResult = syncService.exportBackupToFile();

    assert.ok(fs.existsSync(exportResult.filePath));
    const content = fs.readFileSync(exportResult.filePath, 'utf-8');
    const parsed = JSON.parse(content);

    assert.equal(parsed.meta.app, 'DDevUltraHome');
    assert.equal(exportResult.dataHash.length, 64);
    assert.equal(exportResult.fileSize, Buffer.byteLength(content));
  });

  test('rule: restores complete relational state from backup snapshot cleanly', () => {
    // Generate snapshot with original state
    const originalSnapshot = syncService.generateBackupSnapshot();

    // Mutate state: delete all clients and projects
    db.run('DELETE FROM projects;');
    db.run('DELETE FROM clients;');

    assert.equal(db.queryOne('SELECT COUNT(*) as cnt FROM projects;').cnt, 0);
    assert.equal(db.queryOne('SELECT COUNT(*) as cnt FROM clients;').cnt, 0);

    // Restore from snapshot
    const restoreResult = syncService.restoreFromSnapshot(originalSnapshot.payload);

    assert.ok(restoreResult.success);
    assert.ok(restoreResult.totalRestored > 0);

    // Verify restored records
    const restoredPrj = db.queryOne('SELECT * FROM projects WHERE id = ?;', ['prj-bk1']);
    assert.ok(restoredPrj);
    assert.equal(restoredPrj.project_code, 'PRJ-TNR-01');

    const restoredCli = db.queryOne('SELECT * FROM clients WHERE id = ?;', ['client-bk1']);
    assert.ok(restoredCli);
    assert.equal(restoredCli.name, 'Arunachalam & Co');
  });

  test('rule: unauthenticated cloud sync is marked FAILED and never claims false success', async () => {
    // Attempt sync with Google Drive without credentials
    const result = await syncService.syncWithCloud({
      provider: 'GOOGLE_DRIVE',
      credentials: null
    });

    assert.equal(result.status, 'FAILED');
    assert.ok(result.error.includes('No credentials provided'));

    // Verify sync_state reflects FAILED status
    const status = syncService.getSyncStatus();
    const gdriveState = status.cloudProviders.find(p => p.cloud_provider === 'GOOGLE_DRIVE');
    assert.ok(gdriveState);
    assert.equal(gdriveState.sync_status, 'FAILED');
    assert.equal(gdriveState.records_synced_count, 0);
  });

  test('rule: verified cloud adapter records SUCCESS with genuine cloud transaction ID', async () => {
    // Simulated cloud adapter with verified mock remote upload
    const mockCloudAdapter = {
      async uploadSnapshot({ dataHash }) {
        return {
          fileId: `gdrive_file_${Date.now()}`,
          hashConfirmed: dataHash
        };
      }
    };

    const result = await syncService.syncWithCloud({
      provider: 'GOOGLE_DRIVE',
      credentials: { token: 'mock-oauth-token' },
      customAdapter: mockCloudAdapter
    });

    assert.equal(result.status, 'SUCCESS');
    assert.ok(result.cloudFileId.startsWith('gdrive_file_'));
    assert.ok(result.recordsSynced > 0);

    // Verify sync_state table reflects SUCCESS
    const status = syncService.getSyncStatus();
    const gdriveState = status.cloudProviders.find(p => p.cloud_provider === 'GOOGLE_DRIVE');
    assert.ok(gdriveState);
    assert.equal(gdriveState.sync_status, 'SUCCESS');
    assert.ok(gdriveState.last_synced_at);
  });

  test('rule: restoreFromSnapshot rejects tampered dataHash and accepts valid/legacy snapshots', () => {
    const snapshot = syncService.generateBackupSnapshot();
    assert.ok(snapshot.payload.dataHash, 'Payload includes dataHash');

    // 1. Tampered payload with corrupted hash must throw Error
    const tamperedPayload = JSON.parse(JSON.stringify(snapshot.payload));
    tamperedPayload.dataHash = '0000000000000000000000000000000000000000000000000000000000000000';

    assert.throws(() => {
      syncService.restoreFromSnapshot(tamperedPayload);
    }, /Integrity check failed: Data hash mismatch/);

    // 2. Untampered payload with correct hash succeeds
    const validRestore = syncService.restoreFromSnapshot(snapshot.payload);
    assert.ok(validRestore.success);

    // 3. Legacy snapshot with no dataHash succeeds (backward compatibility)
    const legacyPayload = JSON.parse(JSON.stringify(snapshot.payload));
    delete legacyPayload.dataHash;
    const legacyRestore = syncService.restoreFromSnapshot(legacyPayload);
    assert.ok(legacyRestore.success);
  });
});
