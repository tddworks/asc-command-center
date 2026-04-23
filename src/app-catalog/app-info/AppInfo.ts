import { makeAutoObservable, runInAction } from 'mobx';
import { AppInfoLocalization } from './AppInfoLocalization.ts';
import type { AppInfoRepository } from './AppInfoRepository.ts';
import type { Affordances } from '../../shared/types.ts';

export interface AppInfoInit {
  id: string;
  appId: string;
  primaryCategoryId: string | null;
  secondaryCategoryId: string | null;
  /** Convenience: applies to the primary-locale localization at construction
   *  time when that localization has no privacy URL of its own. Kept for
   *  backwards compatibility — prefer setting it on the localization init. */
  privacyPolicyUrl?: string | null;
  /** Same story as `privacyPolicyUrl`. */
  privacyChoicesUrl?: string | null;
  /** `USES_THIRD_PARTY_CONTENT` / `DOES_NOT_USE_THIRD_PARTY_CONTENT` / null. */
  contentRightsDeclaration?: string | null;
  primaryLocale: string;
  localizations: AppInfoLocalization[];
  /** HATEOAS affordances from the backend (updateCategories, createLocalization, …). */
  affordances?: Affordances;
  /** Backend-owned lifecycle state — e.g. READY_FOR_DISTRIBUTION. Informational only. */
  state?: string;
  /** Live App Store status derived from the most recent version (READY_FOR_SALE, …). */
  appStoreState?: string;
  /** Age rating produced by Apple's questionnaire — e.g. FOUR_PLUS. Read-only until we ship the editor. */
  appStoreAgeRating?: string;
}

/** Accepts the flat string id the `asc` backend ships today and the nested
 *  Apple shape (`{ id: 'FINANCE' }`) older fixtures still use. */
function pickCategoryId(flat: unknown, nested: unknown): string | null {
  if (typeof flat === 'string' && flat.length > 0) return flat;
  if (typeof nested === 'string') return nested;
  if (nested && typeof nested === 'object' && 'id' in nested) {
    const id = (nested as { id?: unknown }).id;
    return typeof id === 'string' ? id : null;
  }
  return null;
}

/** Snapshot of the category-level fields used for dirty tracking + discard.
 *  Per-locale fields (name, subtitle, privacy URLs) live on each
 *  AppInfoLocalization's own snapshot. */
interface CategorySnapshot {
  primaryCategoryId: string | null;
  secondaryCategoryId: string | null;
  contentRightsDeclaration: string | null;
  localeIds: Set<string>;
}

/**
 * AppInfo — aggregate root for the app-metadata slice under App Catalog.
 *
 * Mutable observable. Holds the category-level fields that Apple's AppInfo
 * resource owns (primary/secondary category, content-rights declaration) and
 * a list of per-locale `AppInfoLocalization` entries that own everything else
 * (name, subtitle, privacy URLs).
 *
 * `save()` orchestrates the write: POST new locales, DELETE removed locales,
 * PATCH dirty locales, PATCH categories when category-level fields changed.
 */
export class AppInfo {
  readonly id: string;
  readonly appId: string;
  readonly primaryLocale: string;

  primaryCategoryId: string | null;
  secondaryCategoryId: string | null;
  contentRightsDeclaration: string | null;
  localizations: AppInfoLocalization[];
  affordances: Affordances;
  state: string | undefined;
  appStoreState: string | undefined;
  appStoreAgeRating: string | undefined;

  repository: AppInfoRepository | null = null;

  private snapshot: CategorySnapshot;
  /** Buffer for localizations removed since the last save — restored on discard. */
  private removedBuffer: Map<string, AppInfoLocalization> = new Map();

  constructor(init: AppInfoInit) {
    this.id = init.id;
    this.appId = init.appId;
    this.primaryLocale = init.primaryLocale;
    this.primaryCategoryId = init.primaryCategoryId;
    this.secondaryCategoryId = init.secondaryCategoryId;
    this.contentRightsDeclaration = init.contentRightsDeclaration ?? null;
    this.localizations = [...init.localizations];
    this.affordances = init.affordances ?? {};
    this.state = init.state;
    this.appStoreState = init.appStoreState;
    this.appStoreAgeRating = init.appStoreAgeRating;

    // Migration shim: if init carries top-level privacy URLs and the primary
    // loc hasn't got them set, apply them BEFORE we snapshot — so the loc
    // starts clean rather than instantly dirty.
    this.applyLegacyPrivacyInit(init);

    this.snapshot = this.captureSnapshot();

    makeAutoObservable(this, {
      id: false, appId: false, primaryLocale: false, repository: false,
    });
  }

  private applyLegacyPrivacyInit(init: AppInfoInit): void {
    const primary = this.localizationFor(this.primaryLocale);
    if (!primary) return;
    if (init.privacyPolicyUrl !== undefined && primary.privacyPolicyUrl === null) {
      primary.privacyPolicyUrl = init.privacyPolicyUrl;
      primary.markSaved();
    }
    if (init.privacyChoicesUrl !== undefined && primary.privacyChoicesUrl === null) {
      primary.privacyChoicesUrl = init.privacyChoicesUrl;
      primary.markSaved();
    }
  }

  // ── Privacy URL facade — delegates to the primary localization ──

  get privacyPolicyUrl(): string | null {
    return this.localizationFor(this.primaryLocale)?.privacyPolicyUrl ?? null;
  }

  get privacyChoicesUrl(): string | null {
    return this.localizationFor(this.primaryLocale)?.privacyChoicesUrl ?? null;
  }

  setPrivacyPolicyUrl(url: string | null): void {
    this.localizationFor(this.primaryLocale)?.setPrivacyPolicyUrl(url);
  }

  setPrivacyChoicesUrl(url: string | null): void {
    this.localizationFor(this.primaryLocale)?.setPrivacyChoicesUrl(url);
  }

  // ── Category-level setters ──

  setPrimaryCategory(id: string | null): void {
    this.primaryCategoryId = id;
  }

  setSecondaryCategory(id: string | null): void {
    this.secondaryCategoryId = id;
  }

  setContentRightsDeclaration(decl: string | null): void {
    this.contentRightsDeclaration = decl;
  }

  // ── Capability checks ──

  get canUpdateCategories(): boolean {
    return 'updateCategories' in this.affordances;
  }

  get canCreateLocalization(): boolean {
    return 'createLocalization' in this.affordances;
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
    if (this.categoriesDirty) return true;
    if (this.removedBuffer.size > 0) return true;
    for (const loc of this.localizations) {
      if (!this.snapshot.localeIds.has(loc.locale)) return true;
      if (loc.hasUnsavedChanges) return true;
    }
    return false;
  }

  get categoriesDirty(): boolean {
    return (
      this.primaryCategoryId !== this.snapshot.primaryCategoryId ||
      this.secondaryCategoryId !== this.snapshot.secondaryCategoryId ||
      this.contentRightsDeclaration !== this.snapshot.contentRightsDeclaration
    );
  }

  discard(): void {
    this.primaryCategoryId = this.snapshot.primaryCategoryId;
    this.secondaryCategoryId = this.snapshot.secondaryCategoryId;
    this.contentRightsDeclaration = this.snapshot.contentRightsDeclaration;

    // Drop locally-added locales; restore locally-removed ones.
    this.localizations = this.localizations.filter((l) =>
      this.snapshot.localeIds.has(l.locale),
    );
    for (const [locale, loc] of this.removedBuffer) {
      if (!this.localizationFor(locale)) this.localizations.push(loc);
    }
    this.removedBuffer.clear();

    for (const loc of this.localizations) loc.discard();
  }

  /**
   * Called after a successful save. Promotes current state to the new
   * snapshot so subsequent edits are diffable.
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
    const repo = this.repository;

    // 1. Newly-added locales → POST and backfill id.
    for (const loc of this.localizations) {
      if (loc.id === '') {
        const { id } = await repo.createLocalization(this, loc);
        runInAction(() => loc.markSaved(id));
      }
    }

    // 2. Existing dirty locales → PATCH.
    for (const loc of this.localizations) {
      if (loc.id !== '' && loc.hasUnsavedChanges) {
        await repo.saveLocalization(loc);
        runInAction(() => loc.markSaved());
      }
    }

    // 3. Removed locales → DELETE. Locally-added-then-removed entries never
    //    hit the backend, so they're skipped via the empty-id check.
    for (const loc of this.removedBuffer.values()) {
      if (loc.id !== '') await repo.deleteLocalization(loc);
    }

    // 4. Category-level fields → PATCH only when they actually changed.
    if (this.categoriesDirty) {
      await repo.saveCategories(this);
    }

    runInAction(() => {
      this.removedBuffer.clear();
      this.snapshot = this.captureSnapshot();
    });
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

  /** Build an AppInfo from the raw JSON shape the backend sends. Accepts the
   *  flat fields the `asc` backend uses today AND the Apple-shaped nested
   *  `primaryCategory: { id }` payload for compatibility. Affordances are read
   *  as already-flattened by `apiClient.normalizeLinks`. */
  static fromJSON(json: Record<string, unknown>): AppInfo {
    const rawLocalizations = (json.localizations as Record<string, unknown>[] | undefined) ?? [];
    return new AppInfo({
      id: (json.id as string) ?? '',
      appId: (json.appId as string) ?? '',
      primaryCategoryId: pickCategoryId(json.primaryCategoryId, json.primaryCategory),
      secondaryCategoryId: pickCategoryId(json.secondaryCategoryId, json.secondaryCategory),
      privacyPolicyUrl: (json.privacyPolicyUrl as string | null | undefined) ?? undefined,
      privacyChoicesUrl: (json.privacyChoicesUrl as string | null | undefined) ?? undefined,
      contentRightsDeclaration: (json.contentRightsDeclaration as string | null) ?? null,
      appStoreAgeRating: (json.appStoreAgeRating as string | undefined) ?? undefined,
      state: (json.state as string | undefined) ?? undefined,
      appStoreState: (json.appStoreState as string | undefined) ?? undefined,
      affordances: (json.affordances as Affordances | undefined) ?? {},
      primaryLocale: (json.primaryLocale as string) ?? 'en-US',
      localizations: rawLocalizations.map((l) => AppInfoLocalization.fromJSON(l)),
    });
  }

  // ── Snapshot ──

  private captureSnapshot(): CategorySnapshot {
    return {
      primaryCategoryId: this.primaryCategoryId,
      secondaryCategoryId: this.secondaryCategoryId,
      contentRightsDeclaration: this.contentRightsDeclaration,
      localeIds: new Set(this.localizations.map((l) => l.locale)),
    };
  }
}
