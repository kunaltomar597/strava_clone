/**
 * Vendor-specific battery-manager guidance, per the release checklist's
 * Phase 4 "vendor battery-manager guide" item. Several major Android
 * OEMs kill background apps far more aggressively than stock Android,
 * regardless of standard permissions — this is common, well-documented
 * behavior (see https://dontkillmyapp.com for the community reference this
 * mirrors), not something any one app's code can fully work around. The
 * best available mitigation is telling the user exactly which setting to
 * flip for their specific device.
 *
 * Exact menu wording drifts across OS versions and regions, so each step is
 * phrased as "look for something like X" rather than an exact tap path —
 * this could not be verified against a real device in this environment
 * (see docs/release-checklist.md's Phase 4 entry).
 */
export interface BatteryGuideEntry {
  /** Matches expo-device's `Device.brand` (lowercased) for this vendor. */
  brandMatches: string[];
  vendorLabel: string;
  steps: string[];
}

const VENDOR_GUIDES: BatteryGuideEntry[] = [
  {
    brandMatches: ["xiaomi", "redmi", "poco"],
    vendorLabel: "Xiaomi / Redmi / POCO (MIUI)",
    steps: [
      "Settings → Apps → Manage apps → Stride → Battery saver → set to \"No restrictions\".",
      "Settings → Apps → Permissions → Autostart → enable Stride.",
      "Recent apps → long-press the Stride card → tap the lock icon so it isn't cleared when you swipe away recent apps.",
    ],
  },
  {
    brandMatches: ["oppo", "realme", "oneplus"],
    vendorLabel: "OPPO / realme / OnePlus (ColorOS / OxygenOS)",
    steps: [
      "Settings → Battery → App battery management → Stride → set to \"Allow background activity\" / disable \"Sleep\".",
      "Settings → Apps → Stride → Battery usage → \"Don't optimize\".",
      "Recent apps → long-press or swipe down on the Stride card → enable \"Lock this app\".",
    ],
  },
  {
    brandMatches: ["vivo"],
    vendorLabel: "Vivo (Funtouch OS / OriginOS)",
    steps: [
      "Settings → Battery → Background power consumption management → Stride → \"Allow\".",
      "Settings → Apps → Autostart → enable Stride.",
      "Recent apps → long-press the Stride card → enable the lock/pin option.",
    ],
  },
  {
    brandMatches: ["huawei", "honor"],
    vendorLabel: "Huawei / Honor (EMUI / MagicUI)",
    steps: [
      "Settings → Battery → App launch → Stride → switch off \"Manage automatically\", then enable \"Auto-launch\", \"Secondary launch\", and \"Run in background\".",
      "Recent apps → long-press the Stride card → enable the lock option.",
    ],
  },
  {
    brandMatches: ["samsung"],
    vendorLabel: "Samsung (One UI)",
    steps: [
      "Settings → Apps → Stride → Battery → set to \"Unrestricted\".",
      "Settings → Battery and device care → Battery → Background usage limits → make sure Stride is not in \"Sleeping apps\" or \"Deep sleeping apps\".",
    ],
  },
  {
    brandMatches: ["asus"],
    vendorLabel: "ASUS (ZenUI)",
    steps: [
      "Settings → Battery → Battery optimization → Stride → \"Don't optimize\".",
      "Mobile Manager app → Auto-start Manager → enable Stride.",
    ],
  },
];

const GENERIC_STEPS = [
  "Open your phone's Settings → Apps → Stride → Battery, and choose the least restrictive option (often called \"Unrestricted\", \"No restrictions\", or \"Don't optimize\").",
  "If your phone has a separate \"Autostart\" or \"Auto-launch\" permission list, make sure Stride is enabled there too.",
  "Avoid \"force stopping\" or swiping away Stride from recent apps while a recording is active — some manufacturers treat that as a signal to stop background tracking permanently.",
];

/**
 * Looks up guidance for a device brand as reported by `expo-device`'s
 * `Device.brand` (e.g. "xiaomi", "google", "samsung"). Falls back to
 * generic, still-useful steps for brands not in the table (including every
 * iOS device and stock/Pixel Android, which don't need this).
 */
export function getBatteryGuide(brand: string | null | undefined): BatteryGuideEntry {
  const normalized = brand?.toLowerCase().trim() ?? "";
  const match = VENDOR_GUIDES.find((entry) => entry.brandMatches.includes(normalized));
  if (match) return match;
  return { brandMatches: [], vendorLabel: "Your device", steps: GENERIC_STEPS };
}
