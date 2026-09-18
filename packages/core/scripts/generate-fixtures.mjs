#!/usr/bin/env node
// Generates the three GPX fixtures used by packages/core's test suite:
// a run with a mid-activity stop, a ride, and a noisy city track. Values
// are synthetic but geometrically plausible (fixed bearing + small GPS
// jitter), which is enough to exercise filtering, smoothing, auto-pause,
// splits and best-efforts deterministically. Re-run with `node
// scripts/generate-fixtures.mjs` any time the fixture shape needs to change.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "..", "test", "fixtures");

function mulberry32(seed) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const METERS_PER_DEG_LAT = 111320;

function metersToLatLng(originLat, originLng, northM, eastM) {
  const lat = originLat + northM / METERS_PER_DEG_LAT;
  const metersPerDegLng = METERS_PER_DEG_LAT * Math.cos((originLat * Math.PI) / 180);
  const lng = originLng + eastM / metersPerDegLng;
  return { lat, lng };
}

function buildTrack({ originLat, originLng, startTime, samples }) {
  const points = [];
  for (const s of samples) {
    const { lat, lng } = metersToLatLng(originLat, originLng, s.northM, s.eastM);
    points.push({
      lat,
      lng,
      ele: s.ele,
      time: new Date(startTime + s.tMs).toISOString(),
    });
  }
  return points;
}

function toGpx(name, points) {
  const trkpts = points
    .map(
      (p) =>
        `      <trkpt lat="${p.lat.toFixed(7)}" lon="${p.lng.toFixed(7)}"><ele>${p.ele.toFixed(1)}</ele><time>${p.time}</time></trkpt>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Stride fixture generator" xmlns="http://www.topografix.com/GPX/1/1">\n  <trk>\n    <name>${name}</name>\n    <trkseg>\n${trkpts}\n    </trkseg>\n  </trk>\n</gpx>\n`;
}

// --- Fixture 1: a 20-minute run with a 2-minute stop in the middle ---
function generateRunWithStop() {
  const rand = mulberry32(1);
  const paceMps = 3.0; // ~5:33/km
  const samples = [];
  let t = 0;
  let dist = 0;
  const stopStartS = 600;
  const stopDurationS = 120;

  for (let s = 0; s <= 1200; s++) {
    const isStopped = s >= stopStartS && s < stopStartS + stopDurationS;
    if (!isStopped) dist += paceMps;
    const jitter = () => (rand() - 0.5) * 4; // ~+/-2m GPS jitter
    samples.push({
      tMs: s * 1000,
      northM: dist + jitter(),
      eastM: jitter(),
      ele: 50 + 10 * Math.sin(dist / 300) + (rand() - 0.5) * 0.5,
    });
    t = s;
  }
  void t;
  return samples;
}

// --- Fixture 2: a 30-minute ride with a climb ---
function generateRide() {
  const rand = mulberry32(2);
  const speedMps = 7; // 25.2 km/h
  const samples = [];
  let dist = 0;

  for (let s = 0; s <= 1800; s++) {
    dist += speedMps;
    const jitter = () => (rand() - 0.5) * 6;
    samples.push({
      tMs: s * 1000,
      northM: dist * 0.9 + jitter(),
      eastM: dist * 0.3 + jitter(),
      ele: 20 + (dist / 21600) * 150 + (rand() - 0.5) * 1,
    });
  }
  return samples;
}

// --- Fixture 3: a 10-minute noisy city track with several short stops ---
function generateNoisyCity() {
  const rand = mulberry32(3);
  const paceMps = 1.4; // brisk walk/jog mix
  const samples = [];
  let dist = 0;
  const stopWindows = [
    [120, 20],
    [300, 35],
    [480, 15],
  ];

  for (let s = 0; s <= 600; s++) {
    const stopped = stopWindows.some(([start, dur]) => s >= start && s < start + dur);
    if (!stopped) dist += paceMps;
    // Occasional large accuracy spikes simulate urban-canyon multipath,
    // represented here as bigger positional jitter than the other fixtures.
    const spike = rand() < 0.08 ? 25 : 3;
    const jitter = () => (rand() - 0.5) * spike;
    samples.push({
      tMs: s * 1000,
      northM: dist + jitter(),
      eastM: Math.sin(dist / 40) * 8 + jitter(),
      ele: 30 + (rand() - 0.5) * 2,
    });
  }
  return samples;
}

const fixtures = [
  {
    file: "run-with-stop.gpx",
    name: "Run with stop",
    samples: generateRunWithStop(),
    origin: { lat: 40.73061, lng: -73.935242 },
  },
  {
    file: "ride.gpx",
    name: "Ride",
    samples: generateRide(),
    origin: { lat: 37.774929, lng: -122.419416 },
  },
  {
    file: "noisy-city.gpx",
    name: "Noisy city track",
    samples: generateNoisyCity(),
    origin: { lat: 51.507351, lng: -0.127758 },
  },
];

for (const fixture of fixtures) {
  const points = buildTrack({
    originLat: fixture.origin.lat,
    originLng: fixture.origin.lng,
    startTime: Date.parse("2026-01-15T07:00:00Z"),
    samples: fixture.samples,
  });
  const gpx = toGpx(fixture.name, points);
  writeFileSync(join(outDir, fixture.file), gpx, "utf8");
  console.log(`Wrote ${fixture.file} (${points.length} points)`);
}
