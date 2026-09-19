import { Platform } from "react-native";
import * as Notifications from "expo-notifications";

const CHANNEL_ID = "recording";
const NOTIFICATION_ID = "recording-live-stats";

let handlerInstalled = false;
let channelReady = false;

/**
 * expo-notifications needs an explicit handler to decide whether a
 * notification is shown while the app is foregrounded — without one it
 * won't display anything, which would defeat the point of an
 * always-visible recording indicator (the user is usually looking at the
 * Record screen itself while this is up). Installed lazily, once, the
 * first time a recording actually needs it.
 */
function ensureHandlerInstalled(): void {
  if (handlerInstalled) return;
  handlerInstalled = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

async function ensureChannel(): Promise<void> {
  if (channelReady) return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: "Recording",
    importance: Notifications.AndroidImportance.LOW,
    sound: null,
    vibrationPattern: null,
    enableVibrate: false,
    showBadge: false,
  });
  channelReady = true;
}

/**
 * Android's equivalent of a foreground-service indicator for
 * ExpoLocationSource: an ongoing (`sticky`, non-swipe-dismissable), silent
 * notification showing live stats, so both the OS and the user can see
 * recording is active while the app is backgrounded. This closes the
 * "Android persistent live-stats notification" gap the release checklist
 * flagged under Phase 10.
 *
 * iOS has no equivalent always-visible mechanism short of a Live Activity
 * (the release checklist's other open item there, which needs a physical
 * device and its own Expo config plugin to build against) — a no-op there.
 *
 * This does not by itself fix expo-location's background-delivery
 * reliability gap (see ExpoLocationSource's own doc comment); it only
 * gives the user and the OS's process scheduler a visible, honest signal
 * that recording is meant to still be running.
 */
export async function presentOrUpdateRecordingNotification(text: string): Promise<void> {
  if (Platform.OS !== "android") return;
  ensureHandlerInstalled();
  await ensureChannel();
  await Notifications.scheduleNotificationAsync({
    identifier: NOTIFICATION_ID,
    content: {
      title: "Recording",
      body: text,
      sticky: true,
      autoDismiss: false,
      priority: "low",
    },
    trigger: null,
  });
}

export async function dismissRecordingNotification(): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.dismissNotificationAsync(NOTIFICATION_ID);
}
