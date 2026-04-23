import { makeAutoObservable } from 'mobx';
import type { Affordances } from '../../shared/types.ts';

export interface VersionLocalizationInit {
  /** Backend resource id. Empty for a locally-added locale awaiting save. */
  id: string;
  /** Locale code — identity from the user's perspective. Immutable. */
  locale: string;
  description: string;
  keywords: string;
  whatsNew: string;
  promotionalText: string;
  supportUrl: string | null;
  marketingUrl: string | null;
  affordances?: Affordances;
}

/**
 * One locale's version-scoped textual metadata — what Apple stores on
 * `AppStoreVersionLocalization`. Mirrors `AppInfoLocalization` in shape but
 * covers version-level fields (description / keywords / whatsNew / promotional
 * text / support & marketing URLs).
 */
export class VersionLocalization {
  id: string;
  readonly locale: string;
  description: string;
  keywords: string;
  whatsNew: string;
  promotionalText: string;
  supportUrl: string | null;
  marketingUrl: string | null;
  affordances: Affordances;

  private snapshot: {
    id: string;
    description: string;
    keywords: string;
    whatsNew: string;
    promotionalText: string;
    supportUrl: string | null;
    marketingUrl: string | null;
  };

  constructor(init: VersionLocalizationInit) {
    this.id = init.id;
    this.locale = init.locale;
    this.description = init.description;
    this.keywords = init.keywords;
    this.whatsNew = init.whatsNew;
    this.promotionalText = init.promotionalText;
    this.supportUrl = init.supportUrl;
    this.marketingUrl = init.marketingUrl;
    this.affordances = init.affordances ?? {};

    this.snapshot = this.capture();
    makeAutoObservable(this, { locale: false });
  }

  // ── Setters ──

  setDescription(v: string): void { this.description = v; }
  setKeywords(v: string): void { this.keywords = v; }
  setWhatsNew(v: string): void { this.whatsNew = v; }
  setPromotionalText(v: string): void { this.promotionalText = v; }
  setSupportUrl(v: string | null): void { this.supportUrl = v; }
  setMarketingUrl(v: string | null): void { this.marketingUrl = v; }

  // ── Dirty tracking ──

  get hasUnsavedChanges(): boolean {
    const s = this.snapshot;
    return (
      this.description !== s.description ||
      this.keywords !== s.keywords ||
      this.whatsNew !== s.whatsNew ||
      this.promotionalText !== s.promotionalText ||
      this.supportUrl !== s.supportUrl ||
      this.marketingUrl !== s.marketingUrl
    );
  }

  discard(): void {
    const s = this.snapshot;
    this.description = s.description;
    this.keywords = s.keywords;
    this.whatsNew = s.whatsNew;
    this.promotionalText = s.promotionalText;
    this.supportUrl = s.supportUrl;
    this.marketingUrl = s.marketingUrl;
  }

  markSaved(assignedId?: string): void {
    if (assignedId !== undefined) this.id = assignedId;
    this.snapshot = this.capture();
  }

  private capture() {
    return {
      id: this.id,
      description: this.description,
      keywords: this.keywords,
      whatsNew: this.whatsNew,
      promotionalText: this.promotionalText,
      supportUrl: this.supportUrl,
      marketingUrl: this.marketingUrl,
    };
  }

  // ── Factory ──

  /** Build a version localization from the raw JSON shape the backend sends.
   *  Affordances are read as already-flattened by `apiClient.normalizeLinks`. */
  static fromJSON(json: Record<string, unknown>): VersionLocalization {
    return new VersionLocalization({
      id: (json.id as string) ?? '',
      locale: (json.locale as string) ?? '',
      description: (json.description as string | null) ?? '',
      keywords: (json.keywords as string | null) ?? '',
      whatsNew: (json.whatsNew as string | null) ?? '',
      promotionalText: (json.promotionalText as string | null) ?? '',
      supportUrl: (json.supportUrl as string | null) ?? null,
      marketingUrl: (json.marketingUrl as string | null) ?? null,
      affordances: (json.affordances as Affordances | undefined) ?? {},
    });
  }
}
