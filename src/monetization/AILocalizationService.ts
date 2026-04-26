/**
 * Port for an AI-driven localization service. Concrete implementations
 * are provided by `asc` plugins (e.g. an OpenAI- or Claude-backed plugin
 * registers itself via `setLocalizationAIService`). The monetization
 * slices import only the port + the registry — they never know which
 * plugin is wired.
 *
 * The localization tabs render an "✨ AI Translate" button when
 * `getLocalizationAIService()` returns a non-null service, and call
 * `translate()` to fill the destination locale's name/description from
 * the source locale's text.
 */
export interface LocalizationAIService {
  /** Translate `text` from `fromLocale` to `toLocale`. The optional
   *  `context` lets callers hint at the surrounding product (e.g.
   *  "subscription tier display name") so plugins can choose tone. */
  translate(input: {
    text: string;
    fromLocale: string;
    toLocale: string;
    context?: string;
  }): Promise<string>;
}

let registered: LocalizationAIService | null = null;

/** Plugins call this on boot to register their AI implementation. */
export function setLocalizationAIService(service: LocalizationAIService): void {
  registered = service;
}

/** Returns `null` when no plugin has registered a service yet. The page
 *  uses that to hide the AI button entirely. */
export function getLocalizationAIService(): LocalizationAIService | null {
  return registered;
}

/** Test-only helper. */
export function resetLocalizationAIService(): void {
  registered = null;
}
