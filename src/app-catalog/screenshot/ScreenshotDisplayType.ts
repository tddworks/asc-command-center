/**
 * App Store screenshot display types — Apple's enum on `AppScreenshotSet`.
 * Each entry knows its label, required pixel dimensions, platform, and
 * whether Apple requires screenshots for it on submission.
 *
 * Mirrors Apple's enum from `AppStoreConnect_Swift_SDK.ScreenshotDisplayType`
 * with the canonical sizes documented in App Store Connect Help.
 */

export type Platform = 'IOS' | 'IPAD_OS' | 'MAC_OS' | 'TV_OS' | 'WATCH_OS' | 'VISION_OS';

export interface DisplayTypeMeta {
  /** Apple API id — the string value used in the backend payload. */
  apiId: string;
  /** Short human label — e.g. "iPhone 6.7"". */
  label: string;
  /** Full marketing name used in secondary hints. */
  fullName: string;
  platform: Platform;
  /** Required pixel dimensions (portrait orientation). */
  width: number;
  height: number;
  /** Whether Apple blocks submission without screenshots for this type. */
  required: boolean;
  /** Max screenshots Apple accepts per set (iOS default is 10; Watch is 10 too). */
  maxScreenshots: number;
  /** Sort order — smaller first; matches the ordering you see in ASC Web. */
  displayOrder: number;
}

export const SCREENSHOT_DISPLAY_TYPES: readonly DisplayTypeMeta[] = [
  // ── iPhone ──
  {
    apiId: 'APP_IPHONE_67', label: 'iPhone 6.7"',  fullName: 'iPhone 15 Pro Max / 16 Plus',
    platform: 'IOS', width: 1290, height: 2796, required: true, maxScreenshots: 10, displayOrder: 10,
  },
  {
    apiId: 'APP_IPHONE_65', label: 'iPhone 6.5"',  fullName: 'iPhone XS Max / 11 Pro Max',
    platform: 'IOS', width: 1284, height: 2778, required: false, maxScreenshots: 10, displayOrder: 20,
  },
  {
    apiId: 'APP_IPHONE_61', label: 'iPhone 6.1"',  fullName: 'iPhone 14 / 15 / 15 Pro',
    platform: 'IOS', width: 1179, height: 2556, required: false, maxScreenshots: 10, displayOrder: 30,
  },
  {
    apiId: 'APP_IPHONE_58', label: 'iPhone 5.8"',  fullName: 'iPhone X / XS / 11 Pro',
    platform: 'IOS', width: 1125, height: 2436, required: false, maxScreenshots: 10, displayOrder: 40,
  },
  {
    apiId: 'APP_IPHONE_55', label: 'iPhone 5.5"',  fullName: 'iPhone 8 Plus',
    platform: 'IOS', width: 1242, height: 2208, required: false, maxScreenshots: 10, displayOrder: 50,
  },

  // ── iPad ──
  {
    apiId: 'APP_IPAD_PRO_3GEN_129', label: 'iPad Pro 12.9" (3rd gen)', fullName: 'iPad Pro 12.9" 2018+',
    platform: 'IPAD_OS', width: 2048, height: 2732, required: true, maxScreenshots: 10, displayOrder: 110,
  },
  {
    apiId: 'APP_IPAD_PRO_3GEN_11', label: 'iPad Pro 11"', fullName: 'iPad Pro 11" / iPad Air',
    platform: 'IPAD_OS', width: 1668, height: 2388, required: false, maxScreenshots: 10, displayOrder: 120,
  },
  {
    apiId: 'APP_IPAD_PRO_129', label: 'iPad Pro 12.9" (2nd gen)', fullName: 'iPad Pro 12.9" 2015–2017',
    platform: 'IPAD_OS', width: 2048, height: 2732, required: false, maxScreenshots: 10, displayOrder: 130,
  },
  {
    apiId: 'APP_IPAD_105', label: 'iPad 10.5"', fullName: 'iPad Pro 10.5" / iPad Air 3',
    platform: 'IPAD_OS', width: 1668, height: 2224, required: false, maxScreenshots: 10, displayOrder: 140,
  },
  {
    apiId: 'APP_IPAD_97', label: 'iPad 9.7"', fullName: 'iPad 5th-8th gen / iPad mini',
    platform: 'IPAD_OS', width: 1536, height: 2048, required: false, maxScreenshots: 10, displayOrder: 150,
  },

  // ── Apple Watch ──
  {
    apiId: 'APP_WATCH_ULTRA', label: 'Apple Watch Ultra', fullName: 'Apple Watch Ultra / Ultra 2',
    platform: 'WATCH_OS', width: 410, height: 502, required: false, maxScreenshots: 10, displayOrder: 210,
  },
  {
    apiId: 'APP_WATCH_SERIES_10', label: 'Apple Watch Series 10', fullName: 'Apple Watch Series 10',
    platform: 'WATCH_OS', width: 416, height: 496, required: false, maxScreenshots: 10, displayOrder: 220,
  },
  {
    apiId: 'APP_WATCH_SERIES_7', label: 'Apple Watch Series 7', fullName: 'Apple Watch Series 7–9',
    platform: 'WATCH_OS', width: 396, height: 484, required: false, maxScreenshots: 10, displayOrder: 230,
  },
  {
    apiId: 'APP_WATCH_SERIES_4', label: 'Apple Watch Series 4', fullName: 'Apple Watch Series 4–6 / SE',
    platform: 'WATCH_OS', width: 368, height: 448, required: false, maxScreenshots: 10, displayOrder: 240,
  },

  // ── Mac ──
  {
    apiId: 'APP_DESKTOP', label: 'Mac',  fullName: 'macOS',
    platform: 'MAC_OS', width: 2880, height: 1800, required: false, maxScreenshots: 10, displayOrder: 310,
  },

  // ── Apple TV ──
  {
    apiId: 'APP_APPLE_TV', label: 'Apple TV',  fullName: 'tvOS',
    platform: 'TV_OS', width: 3840, height: 2160, required: false, maxScreenshots: 10, displayOrder: 410,
  },

  // ── Apple Vision Pro ──
  {
    apiId: 'APP_APPLE_VISION_PRO', label: 'Apple Vision Pro', fullName: 'visionOS',
    platform: 'VISION_OS', width: 3840, height: 2160, required: false, maxScreenshots: 10, displayOrder: 510,
  },
];

const BY_ID: Map<string, DisplayTypeMeta> = new Map(
  SCREENSHOT_DISPLAY_TYPES.map((t) => [t.apiId, t]),
);

/** Look up a display type by its Apple API id. Returns null if unknown. */
export function displayTypeForId(apiId: string | null | undefined): DisplayTypeMeta | null {
  if (!apiId) return null;
  return BY_ID.get(apiId) ?? null;
}

/** Human-readable dimension string — e.g. "1290 × 2796". */
export function dimensions(meta: DisplayTypeMeta): string {
  return `${meta.width} × ${meta.height}`;
}

/** All display types for a given platform, sorted by displayOrder. */
export function displayTypesForPlatform(platform: Platform): DisplayTypeMeta[] {
  return SCREENSHOT_DISPLAY_TYPES
    .filter((t) => t.platform === platform)
    .sort((a, b) => a.displayOrder - b.displayOrder);
}
