import type { RawFix, SportType } from "@stride/core";
import type { LocationSource, RecorderStatus } from "./types";

/**
 * Adapter for react-native-background-geolocation (Transistor Software),
 * the production recorder per section 2 of the master plan. The package
 * itself is commercial and distributed through the vendor's own private
 * registry — it cannot be installed here, and the license is bought in
 * Phase 11 (so its included year of updates covers the first year after
 * launch), not before.
 *
 * This class exists so the rest of the app (state machine, hooks, UI)
 * compiles and can be developed today against the real LocationSource
 * interface: `useRecorder` picks ExpoLocationSource in dev/tests and would
 * pick this once implemented. Implementing it for real means following
 * https://github.com/transistorsoft/react-native-background-geolocation/blob/master/help/INSTALL-EXPO.md
 * and wiring BackgroundGeolocation.onLocation / .start / .stop / the
 * plugin's own SQLite `getLocations()` to this shape, using the workout-mode
 * settings section 2 specifies (When-In-Use, highest accuracy, 0 distance
 * filter, no stop-detection, native HTTP sync off).
 */
export class TransistorSource implements LocationSource {
  private static readonly NOT_INSTALLED_MESSAGE =
    "TransistorSource requires react-native-background-geolocation, a commercial package not installed in this project (see the class doc comment). Use ExpoLocationSource or ReplaySource until the license is purchased and this class is implemented.";

  async start(_sport: SportType): Promise<void> {
    throw new Error(TransistorSource.NOT_INSTALLED_MESSAGE);
  }

  async stop(): Promise<void> {
    throw new Error(TransistorSource.NOT_INSTALLED_MESSAGE);
  }

  onFix(_listener: (fix: RawFix) => void): () => void {
    throw new Error(TransistorSource.NOT_INSTALLED_MESSAGE);
  }

  async readPersistedFixes(_sinceTs: number): Promise<RawFix[]> {
    throw new Error(TransistorSource.NOT_INSTALLED_MESSAGE);
  }

  async clearPersistedFixes(): Promise<void> {
    throw new Error(TransistorSource.NOT_INSTALLED_MESSAGE);
  }

  async updateNotificationText(): Promise<void> {
    throw new Error(TransistorSource.NOT_INSTALLED_MESSAGE);
  }

  async getStatus(): Promise<RecorderStatus> {
    throw new Error(TransistorSource.NOT_INSTALLED_MESSAGE);
  }
}
