/**
 * Centralized registry of App Store categories.
 * Mirrors `AppCategoryRegistry.swift` in the Swift SDK — every entry is keyed
 * by Apple's API ID (what the backend sends in `primaryCategoryId`) and
 * carries a human-readable label for the UI.
 *
 * Entries are defined in the order Apple presents them in App Store Connect.
 */

export interface AppCategory {
  /** Apple API identifier — the string value stored in `primaryCategoryId`. */
  apiId: string;
  /** Human-readable label shown in the UI. */
  label: string;
  /** Optional SF-Symbols-ish icon hint for future use. */
  icon?: string;
}

export const APP_CATEGORIES: readonly AppCategory[] = [
  { apiId: 'BOOKS',                   label: 'Books',                   icon: 'book.closed' },
  { apiId: 'BUSINESS',                label: 'Business',                icon: 'briefcase' },
  { apiId: 'DEVELOPER_TOOLS',         label: 'Developer Tools',         icon: 'hammer' },
  { apiId: 'EDUCATION',               label: 'Education',               icon: 'graduationcap' },
  { apiId: 'ENTERTAINMENT',           label: 'Entertainment',           icon: 'tv' },
  { apiId: 'FINANCE',                 label: 'Finance',                 icon: 'dollarsign.circle' },
  { apiId: 'FOOD_AND_DRINK',          label: 'Food & Drink',            icon: 'fork.knife' },
  { apiId: 'GAMES',                   label: 'Games',                   icon: 'gamecontroller' },
  { apiId: 'GRAPHICS_AND_DESIGN',     label: 'Graphics & Design',       icon: 'paintbrush' },
  { apiId: 'HEALTH_AND_FITNESS',      label: 'Health & Fitness',        icon: 'heart' },
  { apiId: 'LIFESTYLE',               label: 'Lifestyle',               icon: 'leaf' },
  { apiId: 'MAGAZINE_AND_NEWSPAPERS', label: 'Magazines & Newspapers',  icon: 'newspaper.fill' },
  { apiId: 'MEDICAL',                 label: 'Medical',                 icon: 'cross.case' },
  { apiId: 'MUSIC',                   label: 'Music',                   icon: 'music.note' },
  { apiId: 'NAVIGATION',              label: 'Navigation',              icon: 'map' },
  { apiId: 'NEWS',                    label: 'News',                    icon: 'newspaper' },
  { apiId: 'PHOTO_AND_VIDEO',         label: 'Photo & Video',           icon: 'camera' },
  { apiId: 'PRODUCTIVITY',            label: 'Productivity',            icon: 'checkmark.circle' },
  { apiId: 'REFERENCE',               label: 'Reference',               icon: 'book' },
  { apiId: 'SHOPPING',                label: 'Shopping',                icon: 'bag' },
  { apiId: 'SOCIAL_NETWORKING',       label: 'Social Networking',       icon: 'person.2' },
  { apiId: 'SPORTS',                  label: 'Sports',                  icon: 'sportscourt' },
  { apiId: 'STICKERS',                label: 'Stickers',                icon: 'square.on.circle' },
  { apiId: 'TRAVEL',                  label: 'Travel',                  icon: 'airplane' },
  { apiId: 'UTILITIES',               label: 'Utilities',               icon: 'wrench' },
  { apiId: 'WEATHER',                 label: 'Weather',                 icon: 'cloud.sun' },
];

const BY_ID: Map<string, AppCategory> = new Map(APP_CATEGORIES.map((c) => [c.apiId, c]));

/** Resolve a category by API id. Returns `null` for unknown ids. */
export function categoryForId(apiId: string | null | undefined): AppCategory | null {
  if (!apiId) return null;
  return BY_ID.get(apiId) ?? null;
}

/** Human label for an api id — falls back to the id itself if unknown. */
export function categoryLabel(apiId: string | null | undefined): string {
  if (!apiId) return '';
  return BY_ID.get(apiId)?.label ?? apiId;
}
