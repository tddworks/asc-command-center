import { makeAutoObservable, runInAction } from 'mobx';
import { AppInfoLocalization } from './AppInfoLocalization.ts';
import type { AppInfoRepository } from './AppInfoRepository.ts';
import { APP_STORE_LOCALES, type AppStoreLocale } from './AppStoreLocaleRegistry.ts';
import type { Affordances } from '../../shared/types.ts';
import type { AgeRatingDeclaration } from '../age-rating/AgeRatingDeclaration.ts';

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

  /** The editable age-rating declaration, loaded on demand when the user
   *  opens the wizard. Stays null until `loadAgeRating()` succeeds. */
  ageRating: AgeRatingDeclaration | null = null;

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

  /** True when the backend exposes a getter for the linked age-rating
   *  declaration. Variants: `getAgeRatingDeclaration` (verb+resource),
   *  `ageRatingDeclaration` (plain relationship), `getAgeRating` (shorter). */
  get canLoadAgeRating(): boolean {
    return (
      'getAgeRatingDeclaration' in this.affordances ||
      'ageRatingDeclaration' in this.affordances ||
      'getAgeRating' in this.affordances
    );
  }

  // ── Localization management ──

  localizationFor(locale: string): AppInfoLocalization | undefined {
    return this.localizations.find((l) => l.locale === locale);
  }

  /** App Store locales not yet attached to this AppInfo. The picker lists
   *  these so the user chooses from a known set instead of typing a code. */
  get availableLocalesToAdd(): AppStoreLocale[] {
    const taken = new Set(this.localizations.map((l) => l.locale));
    return APP_STORE_LOCALES.filter((l) => !taken.has(l.code));
  }

  addLocalization(
    locale: string,
    init: { name?: string; subtitle?: string | null } = {},
  ): AppInfoLocalization {
    if (this.localizationFor(locale)) {
      throw new Error(`Locale ${locale} already exists on AppInfo ${this.id}`);
    }
    // Mirror the iOS Mac app (`AppLanguages.createLocalizationContentFromPrimary`):
    // inherit name, subtitle, and privacy URLs from the primary localization.
    // Apple's AppInfoLocalizationCreateRequest requires a non-empty `name`;
    // sending `""` makes the asc backend bubble up a 500 from App Store Connect.
    const primary = this.localizationFor(this.primaryLocale);
    const loc = new AppInfoLocalization({
      id: '',
      locale,
      name: init.name ?? primary?.name ?? '',
      subtitle: init.subtitle !== undefined ? init.subtitle : (primary?.subtitle ?? null),
      privacyPolicyUrl: primary?.privacyPolicyUrl ?? null,
      privacyChoicesUrl: primary?.privacyChoicesUrl ?? null,
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

  /** Saved locales the user has staged for removal but not yet committed.
   *  The picker renders these alongside the live localizations with a
   *  "Removing" treatment so the user can see and undo the pending delete. */
  get pendingRemovals(): AppInfoLocalization[] {
    return [...this.removedBuffer.values()];
  }

  /**
   * Delete a localization right now — fires the backend DELETE immediately
   * and drops the row from the live list on success. Optimistic: the row
   * disappears from the UI before the network round-trip; on failure we
   * restore it at its original index so the user sees their state come back.
   *
   * Use this when the user wants a "delete & be done" gesture (the page
   * table's Delete button). For staged removals that batch with Save, use
   * `removeLocalization` instead.
   */
  async deleteLocalization(locale: string): Promise<void> {
    const idx = this.localizations.findIndex((l) => l.locale === locale);
    if (idx < 0) {
      throw new Error(`Locale ${locale} not found on AppInfo ${this.id}`);
    }
    const loc = this.localizations[idx];

    // Locally-added (never-saved) row → just splice it out, no backend call.
    if (loc.id === '') {
      runInAction(() => { this.localizations.splice(idx, 1); });
      return;
    }

    if (!this.repository) {
      throw new Error(`AppInfo ${this.id} has no repository attached`);
    }

    // Optimistic remove — immediate UI feedback. Restore on failure.
    runInAction(() => { this.localizations.splice(idx, 1); });
    try {
      await loc.delete();
      runInAction(() => { this.snapshot.localeIds.delete(locale); });
    } catch (err) {
      runInAction(() => { this.localizations.splice(idx, 0, loc); });
      throw err;
    }
  }

  /** Undo a staged removal: pull the locale back out of the buffer and
   *  return it to the live list. No-op if the locale wasn't pending. */
  restoreLocalization(locale: string): void {
    const removed = this.removedBuffer.get(locale);
    if (!removed) return;
    this.removedBuffer.delete(locale);
    this.localizations.push(removed);
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

    // 1. Newly-added locales → POST. Creation stays on the aggregate because
    //    it needs parent context (the `createLocalization` affordance lives
    //    on AppInfo itself). After creation we hand the repo AND the fresh
    //    affordances to the new locale so it owns its own lifecycle — a
    //    subsequent edit on the same session can PATCH without a list refresh.
    for (const loc of this.localizations) {
      if (loc.id === '') {
        const { id, affordances } = await repo.createLocalization(this, loc);
        runInAction(() => {
          loc.markSaved(id);
          loc.affordances = affordances;
          loc.setRepository(repo);
        });
      }
    }

    // 2. Existing dirty locales save themselves. The aggregate only asks
    //    "are you dirty?" — the child knows how to persist.
    for (const loc of this.localizations) {
      if (loc.id !== '' && loc.hasUnsavedChanges) {
        await loc.save();
      }
    }

    // 3. Removed locales delete themselves. Locally-added-then-removed
    //    entries never hit the backend (empty id → skip).
    for (const loc of this.removedBuffer.values()) {
      if (loc.id !== '') await loc.delete();
    }

    // 4. Category-level fields → PATCH only when they actually changed.
    //    Categories aren't a child entity, so the aggregate still owns this
    //    via the port directly.
    if (this.categoriesDirty) {
      await repo.saveCategories(this);
    }

    runInAction(() => {
      this.removedBuffer.clear();
      this.snapshot = this.captureSnapshot();
    });
  }

  /** Attach a repository to this aggregate and every child localization.
   *  Cascading keeps the pattern "each domain object owns its lifecycle"
   *  consistent — callers don't have to remember to also wire up children. */
  setRepository(repo: AppInfoRepository): void {
    this.repository = repo;
    for (const loc of this.localizations) loc.setRepository(repo);
  }

  /**
   * Load the linked AgeRatingDeclaration and attach it to this AppInfo.
   * Gates on the backend affordance — callers (the wizard sheet) should
   * render an unsupported-state message if this returns null rather than
   * opening an un-saveable editor. The declaration comes with its own
   * repository already attached, so it can `save()` itself.
   */
  async loadAgeRating(): Promise<AgeRatingDeclaration | null> {
    if (!this.canLoadAgeRating) return null;
    if (!this.repository) {
      throw new Error(`AppInfo ${this.id} has no repository attached`);
    }
    const declaration = await this.repository.ageRating(this);
    runInAction(() => { this.ageRating = declaration; });
    return declaration;
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
