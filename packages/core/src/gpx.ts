import type { RawFix } from "./types.js";

/**
 * Minimal, dependency-free GPX track-point extraction. Deliberately not a
 * general XML parser — it only understands the small subset of GPX that
 * `<trkpt>` elements use, which is all `packages/core` needs to run test
 * fixtures through the real pipeline and, later, to support GPX import.
 */
export function parseGpxTrackPoints(gpxXml: string): RawFix[] {
  const fixes: RawFix[] = [];
  const trkptRegex = /<trkpt\b([^>]*)>([\s\S]*?)<\/trkpt>/g;
  let match: RegExpExecArray | null;
  let segment = 0;
  let lastTs: number | null = null;

  while ((match = trkptRegex.exec(gpxXml)) !== null) {
    const attrs = match[1]!;
    const body = match[2]!;

    const lat = parseFloat(attrValue(attrs, "lat") ?? "NaN");
    const lng = parseFloat(attrValue(attrs, "lon") ?? "NaN");
    if (Number.isNaN(lat) || Number.isNaN(lng)) continue;

    const eleMatch = /<ele>([^<]*)<\/ele>/.exec(body);
    const timeMatch = /<time>([^<]*)<\/time>/.exec(body);
    const hrMatch = /<(?:gpxtpx:)?hr>([^<]*)<\/(?:gpxtpx:)?hr>/.exec(body);
    const cadMatch = /<(?:gpxtpx:)?cad>([^<]*)<\/(?:gpxtpx:)?cad>/.exec(body);

    const ts = timeMatch ? Date.parse(timeMatch[1]!.trim()) : NaN;
    if (Number.isNaN(ts)) continue;

    // A gap of more than 5 minutes between consecutive fixture points is
    // treated as a new recording segment, mirroring how the recorder marks
    // a tracking gap after a kill-and-recover.
    if (lastTs != null && ts - lastTs > 5 * 60 * 1000) {
      segment++;
    }
    lastTs = ts;

    fixes.push({
      ts,
      lat,
      lng,
      alt: eleMatch ? parseFloat(eleMatch[1]!.trim()) : null,
      hAcc: 5,
      vAcc: null,
      speed: null,
      course: null,
      hr: hrMatch ? parseFloat(hrMatch[1]!.trim()) : null,
      cadence: cadMatch ? parseFloat(cadMatch[1]!.trim()) : null,
      segment,
    });
  }

  return fixes;
}

function attrValue(attrs: string, name: string): string | null {
  const regex = new RegExp(`${name}="([^"]*)"`);
  const match = regex.exec(attrs);
  return match ? (match[1] ?? null) : null;
}

/** Encodes fixes as a minimal single-track, single-segment GPX 1.1 document, for export. */
export function encodeGpx(fixes: readonly RawFix[], name: string): string {
  const trkpts = fixes
    .map((f) => {
      const time = new Date(f.ts).toISOString();
      const ele = f.alt != null ? `<ele>${f.alt.toFixed(1)}</ele>` : "";
      return `      <trkpt lat="${f.lat.toFixed(7)}" lon="${f.lng.toFixed(7)}">${ele}<time>${time}</time></trkpt>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Stride" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <name>${escapeXml(name)}</name>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>
`;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
