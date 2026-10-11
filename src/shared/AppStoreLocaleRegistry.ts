/**
 * Centralized registry of App Store locales.
 *
 * Mirrors `Languages.allAppStoreLocales` in the AppMate iOS reference
 * (`LanguageSwitcher/Languages.swift`):
 * the canonical list of locale codes Apple's App Store accepts for app
 * metadata localization.
 *
 * Each entry pairs Apple's locale code (what the backend stores on
 * `AppInfoLocalization.locale`) with a human-readable display name. We pin
 * the display name in code rather than relying on `Intl.DisplayNames` —
 * (a) the list is small and stable, (b) the labels here match what App Store
 * Connect itself shows, which keeps the picker recognisable.
 */

export interface AppStoreLocale {
  /** Apple locale code — value stored in `AppInfoLocalization.locale`. */
  code: string;
  /** Human-readable name shown in the picker. */
  displayName: string;
}

export const APP_STORE_LOCALES: readonly AppStoreLocale[] = [
  { code: 'ar-SA',   displayName: 'Arabic' },
  { code: 'ca',      displayName: 'Catalan' },
  { code: 'cs',      displayName: 'Czech' },
  { code: 'da',      displayName: 'Danish' },
  { code: 'de-DE',   displayName: 'German' },
  { code: 'el',      displayName: 'Greek' },
  { code: 'en-AU',   displayName: 'English (Australia)' },
  { code: 'en-CA',   displayName: 'English (Canada)' },
  { code: 'en-GB',   displayName: 'English (U.K.)' },
  { code: 'en-US',   displayName: 'English (U.S.)' },
  { code: 'es-ES',   displayName: 'Spanish (Spain)' },
  { code: 'es-MX',   displayName: 'Spanish (Mexico)' },
  { code: 'fi',      displayName: 'Finnish' },
  { code: 'fr-CA',   displayName: 'French (Canada)' },
  { code: 'fr-FR',   displayName: 'French' },
  { code: 'he',      displayName: 'Hebrew' },
  { code: 'hi',      displayName: 'Hindi' },
  { code: 'hr',      displayName: 'Croatian' },
  { code: 'hu',      displayName: 'Hungarian' },
  { code: 'id',      displayName: 'Indonesian' },
  { code: 'it',      displayName: 'Italian' },
  { code: 'ja',      displayName: 'Japanese' },
  { code: 'ko',      displayName: 'Korean' },
  { code: 'ms',      displayName: 'Malay' },
  { code: 'nl-NL',   displayName: 'Dutch' },
  { code: 'no',      displayName: 'Norwegian' },
  { code: 'pl',      displayName: 'Polish' },
  { code: 'pt-BR',   displayName: 'Portuguese (Brazil)' },
  { code: 'pt-PT',   displayName: 'Portuguese (Portugal)' },
  { code: 'ro',      displayName: 'Romanian' },
  { code: 'ru',      displayName: 'Russian' },
  { code: 'sk',      displayName: 'Slovak' },
  { code: 'sv',      displayName: 'Swedish' },
  { code: 'th',      displayName: 'Thai' },
  { code: 'tr',      displayName: 'Turkish' },
  { code: 'uk',      displayName: 'Ukrainian' },
  { code: 'vi',      displayName: 'Vietnamese' },
  { code: 'zh-Hans', displayName: 'Chinese (Simplified)' },
  { code: 'zh-Hant', displayName: 'Chinese (Traditional)' },
];

const BY_CODE: Map<string, AppStoreLocale> = new Map(
  APP_STORE_LOCALES.map((l) => [l.code, l]),
);

/** Resolve a locale by Apple code. Returns `null` for unknown codes. */
export function localeForCode(code: string | null | undefined): AppStoreLocale | null {
  if (!code) return null;
  return BY_CODE.get(code) ?? null;
}

/** Human display name for a locale code — falls back to the code itself if unknown. */
export function localeDisplayName(code: string | null | undefined): string {
  if (!code) return '';
  return BY_CODE.get(code)?.displayName ?? code;
}