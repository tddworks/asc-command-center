import { makeAutoObservable, runInAction } from 'mobx';
import { AppInfoLocalization } from './AppInfoLocalization.ts';
import type { AppInfoRepository } from './AppInfoRepository.ts';
import type { Affordances } from '../../shared/types.ts';

export interface AppInfoInit {
  id: string;
  appId: string;
  primaryCategoryId: string | null;
  secondaryCategoryId: string | null;
  privacyPolicyUrl: string | null;
  /** California opt-out URL — rarely set but required in some jurisdictions. */
  privacyChoicesUrl?: string | null;
  supportUrl: string | null;
  marketingUrl: string | null;
  /** `USES_THIRD_PARTY_CONTENT` / `DOES_NOT_USE_THIRD_PARTY_CONTENT` / null. */
  contentRightsDeclaration?: string | null;
  primaryLocale: string;
  localizations: AppInfoLocalization[];
  /** HATEOAS affordances from the backend (updateCategories, listLocalizations, …). */
  affordances?: Affordances;
  /** Backend-owned lifecycle state — e.g. READY_FOR_DISTRIBUTION. Informational only. */
  state?: string;
  /** Live App Store status derived from the most recent version (READY_FOR_SALE, …). */
  appStoreState?: string;
  /** Age rating produced by Apple's questionnaire — e.g. FOUR_PLUS. Read-only until we ship the editor. */
  appStoreAgeRating?: string;
}

/** Snapshot of the top-level fields — used for dirty tracking + discard. */
interface AppInfoSnapshot {
  primaryCategoryId: string | null;
  secondaryCategoryId: string | null;
  privacyPolicyUrl: string | null;
  privacyChoicesUrl: string | null;
  supportUrl: string | null;
  marketingUrl: string | null;
  contentRightsDeclaration: string | null;
  localeIds: Set<string>;
  removedLocales: Map<string, AppInfoLocalization>;
}

/**
 * AppInfo — aggregate root for the app-metadata slice under App Catalog.
 *
 * Mutable observable. Holds top-level fields (categories, privacy/support/
 * marketing URLs) and a list of per-locale `AppInfoLocalization` entries.
 * `hasUnsavedChanges` composes the aggregate's own dirty state with each
 * localization's dirty state, plus any adds/removes since last save.
 */
export class AppInfo {
  readonly id: string;
  readonly appId: string;
  readonly primaryLocale: string;

  primaryCategoryId: string | null;
  secondaryCategoryId: string | null;
  privacyPolicyUrl: string | null;
  privacyChoicesUrl: string | null;
  supportUrl: string | null;
  marketingUrl: string | null;
  contentRightsDeclaration: string | null;
  localizations: AppInfoLocalization[];
  affordances: Affordances;
  state: string | undefined;
  appStoreState: string | undefined;
  appStoreAgeRating: string | undefined;

  repository: AppInfoRepository | null = null;

  private snapshot: AppInfoSnapshot;
  /** Buffer for localizations removed since the last save — restored on discard. */
  private removedBuffer: Map<string, AppInfoLocalization> = new Map();

  constructor(init: AppInfoInit) {
    this.id = init.id;
    this.appId = init.appId;
    this.primaryLocale = init.primaryLocale;
    this.primaryCategoryId = init.primaryCategoryId;
    this.secondaryCategoryId = init.secondaryCategoryId;
    this.privacyPolicyUrl = init.privacyPolicyUrl;
    this.privacyChoicesUrl = init.privacyChoicesUrl ?? null;
    this.supportUrl = init.supportUrl;
    this.marketingUrl = init.marketingUrl;
    this.contentRightsDeclaration = init.contentRightsDeclaration ?? null;
    this.localizations = [...init.localizations];
    this.affordances = init.affordances ?? {};
    this.state = init.state;
    this.appStoreState = init.appStoreState;
    this.appStoreAgeRating = init.appStoreAgeRating;
    this.snapshot = this.captureSnapshot();

    makeAutoObservable(this, {
      id: false, appId: false, primaryLocale: false, repository: false,
    });
  }

  // ── Top-level setters ──

  setPrimaryCategory(id: string | null): void {
    this.primaryCategoryId = id;
  }

  setSecondaryCategory(id: string | null): void {
    this.secondaryCategoryId = id;
  }

  setPrivacyPolicyUrl(url: string | null): void {
    this.privacyPolicyUrl = url;
  }

  setPrivacyChoicesUrl(url: string | null): void {
    this.privacyChoicesUrl = url;
  }

  setSupportUrl(url: string | null): void {
    this.supportUrl = url;
  }

  setMarketingUrl(url: string | null): void {
    this.marketingUrl = url;
  }

  setContentRightsDeclaration(decl: string | null): void {
    this.contentRightsDeclaration = decl;
  }

  // ── Localization management ──

  localizationFor(locale: string): AppInfoLocalization | undefined {
    return this.localizations.find((l) => l.locale === locale);
  }

  addLocalization(
    locale: string,
    init: { name?: string; subtitle?: string | null } = {},
  ): AppInfoLocalization {
    if (this.localizationFor(locale)) {
      throw new Error(`Locale ${locale} already exists on AppInfo ${this.id}`);
    }
    const loc = new AppInfoLocalization({
      id: '',
      locale,
      name: init.name ?? '',
      subtitle: init.subtitle ?? null,
    });
    this.localizations.push(loc);
    return loc;
  }

  removeLocalization(locale: string): void {
    const idx = this.localizations.findIndex((l) => l.locale === locale);
    if (idx < 0) {
      throw new Error(`Locale ${locale} not found on AppInfo ${this.id}`);
    }
    const [removed] = this.localizations.splice(idx, 1);
    // Only buffer locales that were part of the last saved snapshot — so
    // removing a locally-added (unsaved) locale is a true undo on discard.
    if (this.snapshot.localeIds.has(locale)) {
      this.removedBuffer.set(locale, removed);
    }
  }

  // ── Dirty tracking ──

  get hasUnsavedChanges(): boolean {
    if (this.topLevelDirty()) return true;
    if (this.removedBuffer.size > 0) return true;
    // Added: any localization whose id isn't in the snapshot.
    for (const loc of this.localizations) {
      if (!this.snapshot.localeIds.has(loc.locale)) return true;
      if (loc.hasUnsavedChanges) return true;
    }
    return false;
  }

  private topLevelDirty(): boolean {
    return (
      this.primaryCategoryId !== this.snapshot.primaryCategoryId ||
      this.secondaryCategoryId !== this.snapshot.secondaryCategoryId ||
      this.privacyPolicyUrl !== this.snapshot.privacyPolicyUrl ||
      this.privacyChoicesUrl !== this.snapshot.privacyChoicesUrl ||
      this.supportUrl !== this.snapshot.supportUrl ||
      this.marketingUrl !== this.snapshot.marketingUrl ||
      this.contentRightsDeclaration !== this.snapshot.contentRightsDeclaration
    );
  }

  discard(): void {
    this.primaryCategoryId = this.snapshot.primaryCategoryId;
    this.secondaryCategoryId = this.snapshot.secondaryCategoryId;
    this.privacyPolicyUrl = this.snapshot.privacyPolicyUrl;
    this.privacyChoicesUrl = this.snapshot.privacyChoicesUrl;
    this.supportUrl = this.snapshot.supportUrl;
    this.marketingUrl = this.snapshot.marketingUrl;
    this.contentRightsDeclaration = this.snapshot.contentRightsDeclaration;

    // Drop locally-added locales; restore locally-removed ones.
    this.localizations = this.localizations.filter((l) =>
      this.snapshot.localeIds.has(l.locale),
    );
    for (const [locale, loc] of this.removedBuffer) {
      if (!this.localizationFor(locale)) this.localizations.push(loc);
    }
    this.removedBuffer.clear();

    // Reset each localization to its own snapshot.
    for (const loc of this.localizations) loc.discard();
  }

  /**
   * Called by the repository after a successful save. Promotes current state
   * to the new snapshot so subsequent edits are diffable.
   */
  markSaved(): void {
    for (const loc of this.localizations) loc.markSaved();
    this.removedBuffer.clear();
    this.snapshot = this.captureSnapshot();
  }

  // ── Save orchestration ──

  async save(): Promise<void> {
    if (!this.repository) {
      throw new Error(`AppInfo ${this.id} has no repository attached`);
    }
    await this.repository.save(this);
    runInAction(() => this.markSaved());
  }

  setRepository(repo: AppInfoRepository): void {
    this.repository = repo;
  }

  // ── Readiness helpers ──

  get isComplete(): boolean {
    return this.missingFields(this.primaryLocale).length === 0;
  }

  missingFields(locale: string): string[] {
    const missing: string[] = [];
    const loc = this.localizationFor(locale);
    if (!loc || !loc.name.trim()) missing.push('Name');
    if (!loc || !loc.subtitle || !loc.subtitle.trim()) missing.push('Subtitle');
    if (!this.primaryCategoryId) missing.push('Primary category');
    if (!this.privacyPolicyUrl) missing.push('Privacy Policy URL');
    return missing;
  }

  // ── Factory ──

  static fromJSON(json: Record<string, unknown>): AppInfo {
    const rawLocalizations = (json.localizations as Record<string, unknown>[] | undefined) ?? [];
    return new AppInfo({
      id: (json.id as string) ?? '',
      appId: (json.appId as string) ?? '',
      primaryCategoryId: (json.primaryCategoryId as string | null) ?? null,
      secondaryCategoryId: (json.secondaryCategoryId as string | null) ?? null,
      privacyPolicyUrl: (json.privacyPolicyUrl as string | null) ?? null,
      privacyChoicesUrl: (json.privacyChoicesUrl as string | null) ?? null,
      supportUrl: (json.supportUrl as string | null) ?? null,
      marketingUrl: (json.marketingUrl as string | null) ?? null,
      contentRightsDeclaration: (json.contentRightsDeclaration as string | null) ?? null,
      primaryLocale: (json.primaryLocale as string) ?? 'en-US',
      localizations: rawLocalizations.map((l) => new AppInfoLocalization({
        id: (l.id as string) ?? '',
        locale: (l.locale as string) ?? '',
        name: (l.name as string) ?? '',
        subtitle: (l.subtitle as string | null) ?? null,
      })),
    });
  }

  // ── Snapshot ──

  private captureSnapshot(): AppInfoSnapshot {
    return {
      primaryCategoryId: this.primaryCategoryId,
      secondaryCategoryId: this.secondaryCategoryId,
      privacyPolicyUrl: this.privacyPolicyUrl,
      privacyChoicesUrl: this.privacyChoicesUrl,
      supportUrl: this.supportUrl,
      marketingUrl: this.marketingUrl,
      contentRightsDeclaration: this.contentRightsDeclaration,
      localeIds: new Set(this.localizations.map((l) => l.locale)),
      removedLocales: new Map(),
    };
  }
}
