import * as SQLite from "expo-sqlite";

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

/**
 * The on-device store from section 3 of the master plan: `recordings`,
 * `geopoints` (append-only, one row per GPS fix — this is deliberately a
 * server-side rarity but the right shape on the phone), and
 * `recording_events` (start/pause/resume/... transitions, timestamped, so
 * elapsed and moving time can be reconstructed even after a crash).
 * WAL mode + synchronous NORMAL per the plan's durability/perf tradeoff.
 */
export function getLocalDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync("stride.db").then(async (db) => {
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        PRAGMA synchronous = NORMAL;

        CREATE TABLE IF NOT EXISTS recordings (
          id TEXT PRIMARY KEY,
          sport_type TEXT NOT NULL,
          state TEXT NOT NULL,
          started_at INTEGER NOT NULL,
          ended_at INTEGER,
          last_fix_at INTEGER,
          title TEXT,
          description TEXT,
          visibility TEXT,
          map_visibility TEXT,
          upload_state TEXT NOT NULL DEFAULT 'local',
          attempts INTEGER NOT NULL DEFAULT 0,
          last_error TEXT
        );

        CREATE TABLE IF NOT EXISTS geopoints (
          recording_id TEXT NOT NULL,
          seq INTEGER NOT NULL,
          segment INTEGER NOT NULL,
          ts INTEGER NOT NULL,
          lat REAL NOT NULL,
          lng REAL NOT NULL,
          alt REAL,
          h_acc REAL,
          v_acc REAL,
          speed REAL,
          course REAL,
          hr INTEGER,
          cadence INTEGER,
          PRIMARY KEY (recording_id, seq)
        );

        CREATE TABLE IF NOT EXISTS recording_events (
          recording_id TEXT NOT NULL,
          seq INTEGER NOT NULL,
          ts INTEGER NOT NULL,
          type TEXT NOT NULL,
          PRIMARY KEY (recording_id, seq)
        );
      `);
      return db;
    });
  }
  return dbPromise;
}
