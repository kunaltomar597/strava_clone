import type { RawFix } from "@stride/core";
import { getLocalDb } from "@/db/localDb";
import type { RecorderEvent } from "./stateMachine";

/**
 * Appends fixes to the local `geopoints` table in one transaction —
 * "disk first, UI second" (principle #1). `INSERT OR IGNORE` on the
 * (recording_id, seq) primary key makes a retried write after a partial
 * failure safe.
 */
export async function appendFixes(recordingId: string, startSeq: number, fixes: readonly RawFix[]): Promise<void> {
  if (fixes.length === 0) return;
  const db = await getLocalDb();

  await db.withTransactionAsync(async () => {
    for (let i = 0; i < fixes.length; i++) {
      const fix = fixes[i]!;
      await db.runAsync(
        `INSERT OR IGNORE INTO geopoints
           (recording_id, seq, segment, ts, lat, lng, alt, h_acc, v_acc, speed, course, hr, cadence)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          recordingId,
          startSeq + i,
          fix.segment,
          fix.ts,
          fix.lat,
          fix.lng,
          fix.alt ?? null,
          fix.hAcc ?? null,
          fix.vAcc ?? null,
          fix.speed ?? null,
          fix.course ?? null,
          fix.hr ?? null,
          fix.cadence ?? null,
        ],
      );
    }
  });
}

export async function appendEvent(recordingId: string, seq: number, type: RecorderEvent): Promise<void> {
  const db = await getLocalDb();
  await db.runAsync(
    `INSERT OR IGNORE INTO recording_events (recording_id, seq, ts, type) VALUES (?, ?, ?, ?)`,
    [recordingId, seq, Date.now(), type],
  );
}

export async function createRecording(
  id: string,
  sport: string,
  startedAtMs: number,
): Promise<void> {
  const db = await getLocalDb();
  await db.runAsync(
    `INSERT INTO recordings (id, sport_type, state, started_at, upload_state, attempts)
     VALUES (?, ?, 'acquiring', ?, 'local', 0)`,
    [id, sport, startedAtMs],
  );
}

export async function updateRecordingState(id: string, state: string, lastFixAtMs: number | null): Promise<void> {
  const db = await getLocalDb();
  await db.runAsync(`UPDATE recordings SET state = ?, last_fix_at = ? WHERE id = ?`, [state, lastFixAtMs, id]);
}

export async function loadFixes(recordingId: string): Promise<RawFix[]> {
  const db = await getLocalDb();
  const rows = await db.getAllAsync<{
    seq: number;
    segment: number;
    ts: number;
    lat: number;
    lng: number;
    alt: number | null;
    h_acc: number | null;
    v_acc: number | null;
    speed: number | null;
    course: number | null;
    hr: number | null;
    cadence: number | null;
  }>(`SELECT * FROM geopoints WHERE recording_id = ? ORDER BY seq ASC`, [recordingId]);

  return rows.map((row) => ({
    ts: row.ts,
    lat: row.lat,
    lng: row.lng,
    alt: row.alt,
    hAcc: row.h_acc,
    vAcc: row.v_acc,
    speed: row.speed,
    course: row.course,
    hr: row.hr,
    cadence: row.cadence,
    segment: row.segment,
  }));
}
