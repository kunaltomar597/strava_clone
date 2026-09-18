/**
 * A lightweight positional Kalman filter for GPS lat/lng smoothing.
 *
 * This is the well-known "variance" formulation used by many GPS-smoothing
 * implementations (e.g. Google's own answer to the classic "smooth GPS
 * data" problem): latitude and longitude are treated as two independent
 * scalar signals, each fix's reported horizontal accuracy is the
 * measurement noise, and process noise models how fast a person could
 * plausibly have moved since the last fix. It is not a full multivariate
 * Kalman filter (no explicit velocity state) but is cheap, has no
 * dependencies, and is well-suited to smoothing a track that already gets
 * a real velocity estimate from consecutive filtered points.
 */
export class GeoKalmanFilter {
  private variance = -1;
  private lat = 0;
  private lng = 0;
  private lastTs = 0;

  /**
   * @param processNoiseMps Plausible speed (m/s) at which the "true"
   * position can wander between fixes. Higher values trust new fixes more.
   */
  constructor(private readonly processNoiseMps = 3) {}

  reset(): void {
    this.variance = -1;
  }

  /** Feed one fix, returning the smoothed position. */
  process(lat: number, lng: number, accuracyM: number, ts: number): { lat: number; lng: number } {
    const acc = Math.max(1, accuracyM);
    if (this.variance < 0) {
      this.lastTs = ts;
      this.lat = lat;
      this.lng = lng;
      this.variance = acc * acc;
      return { lat, lng };
    }

    const dtS = Math.max(0, (ts - this.lastTs) / 1000);
    this.lastTs = ts;
    if (dtS > 0) {
      this.variance += dtS * this.processNoiseMps * this.processNoiseMps;
    }

    const gain = this.variance / (this.variance + acc * acc);
    this.lat += gain * (lat - this.lat);
    this.lng += gain * (lng - this.lng);
    this.variance = (1 - gain) * this.variance;

    return { lat: this.lat, lng: this.lng };
  }
}
