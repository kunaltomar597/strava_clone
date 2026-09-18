import * as Location from "expo-location";
import type { RawFix, SportType } from "@stride/core";
import type { LocationSource, RecorderStatus } from "./types";

/**
 * The free fallback the master plan names for LocationSource (section 2):
 * "a custom recorder... behind the same interface", using expo-location
 * rather than a hand-written native module, so it ships without waiting on
 * the Transistor SDK license.
 *
 * Known limitation, stated plainly rather than hidden: expo-location's
 * background delivery runs through a JavaScript task, so — per Expo's own
 * docs — updates can stop if the OS kills the JS runtime while
 * backgrounded, and When-In-Use alone does not guarantee delivery while
 * locked the way a foreground service with a visible indicator does. This
 * class is real and usable for foreground recording and short background
 * periods today; it is not a guaranteed drop-in replacement for
 * TransistorSource's reliability during the section 4 field-test matrix
 * (60 minutes locked, swipe-away, etc.) without further hardening —
 * exactly the gap TransistorSource exists to close.
 */
export class ExpoLocationSource implements LocationSource {
  private subscription: Location.LocationSubscription | null = null;
  private listeners = new Set<(fix: RawFix) => void>();
  private lastFix: RawFix | null = null;
  private segment = 0;
  private tracking = false;

  async start(_sport: SportType): Promise<void> {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== Location.PermissionStatus.GRANTED) {
      throw new Error("Location permission was not granted");
    }

    this.tracking = true;
    this.subscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 1000,
        distanceInterval: 0,
      },
      (position) => {
        const fix: RawFix = {
          ts: position.timestamp,
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          alt: position.coords.altitude,
          hAcc: position.coords.accuracy,
          vAcc: position.coords.altitudeAccuracy,
          speed: position.coords.speed,
          course: position.coords.heading,
          hr: null,
          cadence: null,
          segment: this.segment,
        };
        this.lastFix = fix;
        for (const listener of this.listeners) listener(fix);
      },
    );
  }

  async stop(): Promise<void> {
    this.tracking = false;
    this.subscription?.remove();
    this.subscription = null;
    this.segment++;
  }

  onFix(listener: (fix: RawFix) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async readPersistedFixes(_sinceTs: number): Promise<RawFix[]> {
    // No independent native persistence layer beyond what the recorder's
    // own SQLite point writer already captures from onFix — see the class
    // doc comment on why this can't yet promise the same recovery
    // guarantee as TransistorSource's native store.
    return [];
  }

  async clearPersistedFixes(): Promise<void> {}

  async updateNotificationText(_text: string): Promise<void> {
    // A persistent Android notification for this source is Phase 4 work
    // (expo-task-manager + a foreground service); no-op until then.
  }

  async getStatus(): Promise<RecorderStatus> {
    return {
      isTracking: this.tracking,
      lastFixAt: this.lastFix?.ts ?? null,
      lastAccuracyM: this.lastFix?.hAcc ?? null,
    };
  }
}
