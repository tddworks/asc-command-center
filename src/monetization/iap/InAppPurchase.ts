import { makeAutoObservable, runInAction } from 'mobx';
import type { Affordances } from '../../shared/types.ts';
import { InAppPurchaseLocalization } from './InAppPurchaseLocalization.ts';
import type { IAPAvailability } from './IAPAvailability.ts';
import type { IAPPriceSchedule } from './IAPPriceSchedule.ts';
import type {
  IAPCustomerEligibility,
  InAppPurchaseOfferCode,
} from './InAppPurchaseOfferCode.ts';
import type { ReviewScreenshot } from './ReviewScreenshot.ts';
import type { InAppPurchaseRepository } from './InAppPurchaseRepository.ts';

export const InAppPurchaseType = {
  Consumable: 'CONSUMABLE',
  NonConsumable: 'NON_CONSUMABLE',
  NonRenewingSubscription: 'NON_RENEWING_SUBSCRIPTION',
} as const;
export type InAppPurchaseType = typeof InAppPurchaseType[keyof typeof InAppPurchaseType];

export const InAppPurchaseState = {
  MissingMetadata: 'MISSING_METADATA',
  ReadyToSubmit: 'READY_TO_SUBMIT',
  WaitingForReview: 'WAITING_FOR_REVIEW',
  InReview: 'IN_REVIEW',
  DeveloperActionNeeded: 'DEVELOPER_ACTION_NEEDED',
  PendingBinaryApproval: 'PENDING_BINARY_APPROVAL',
  Approved: 'APPROVED',
  DeveloperRemovedFromSale: 'DEVELOPER_REMOVED_FROM_SALE',
  RemovedFromSale: 'REMOVED_FROM_SALE',
  Rejected: 'REJECTED',
} as const;
export type InAppPurchaseState = typeof InAppPurchaseState[keyof typeof InAppPurchaseState];

export interface InAppPurchaseInit {
  id: string;
  appId: string;
  referenceName: string;
  productId: string;
  inAppPurchaseType: InAppPurchaseType | string;
  state: InAppPurchaseState | string;
  reviewNote?: string | null;
  /** Set when the IAP is currently selected for the app's review submission. */
  hasSubmission?: boolean;
  affordances: Affordances;
}

/**
 * InAppPurchase — aggregate root of the IAP slice.
 *
 * Mirrors the Swift SDK's `@Observable class InAppPurchase`. State-driven
 * semantic booleans (`isApproved`, `isEditable`, `canSubmit`) and capability
 * checks (`canDelete`, `canUnsubmit`) drive the UI; child resources
 * (localizations, pricing, availability, offer codes, images) ship in their
 * own slices later.
 */
export class InAppPurchase {
  readonly id: string;
  readonly appId: string;
  referenceName: string;
  readonly productId: string;
  readonly inAppPurchaseType: string;
  state: string;
  reviewNote: string | null;
  hasSubmission: boolean;
  affordances: Affordances;

  /** Localizations loaded for this IAP (empty until `loadLocalizations()`). */
  localizations: InAppPurchaseLocalization[] = [];
  /** True once `loadLocalizations()` has succeeded at least once — distinct
   *  from `localizations.length > 0` so the UI can tell "still loading"
   *  apart from "loaded but empty". */
  isLocalizationsLoaded = false;

  /** Currently uploaded review screenshot, or null when none exists. */
  reviewScreenshot: ReviewScreenshot | null = null;
  /** True once `loadReviewScreenshot()` has resolved. The "no screenshot
   *  yet" empty state and the "still loading" spinner share the same
   *  `null` value otherwise. */
  isReviewScreenshotLoaded = false;

  /** Pricing snapshot (base territory + per-territory prices). Null until
   *  the schedule is loaded; remains null when the IAP has no schedule. */
  priceSchedule: IAPPriceSchedule | null = null;
  /** True once `loadPriceSchedule()` has resolved. */
  isPriceScheduleLoaded = false;

  /** Territory availability + auto-include flag. Null until loaded. */
  availability: IAPAvailability | null = null;
  isAvailabilityLoaded = false;

  /** Offer codes attached to this IAP (empty until loaded). */
  offerCodes: InAppPurchaseOfferCode[] = [];
  isOfferCodesLoaded = false;

  repository: InAppPurchaseRepository | null;

  constructor(init: InAppPurchaseInit, repository: InAppPurchaseRepository | null = null) {
    this.id = init.id;
    this.appId = init.appId;
    this.referenceName = init.referenceName;
    this.productId = init.productId;
    this.inAppPurchaseType = init.inAppPurchaseType;
    this.state = init.state;
    this.reviewNote = init.reviewNote ?? null;
    this.hasSubmission = init.hasSubmission ?? false;
    this.affordances = init.affordances;
    this.repository = repository;

    makeAutoObservable(this, { id: false, appId: false, productId: false, inAppPurchaseType: false, repository: false });
  }

  // ── Semantic Booleans ──

  get isApproved(): boolean { return this.state === InAppPurchaseState.Approved; }
  get isLive(): boolean { return this.isApproved; }
  get isEditable(): boolean {
    return (
      this.state === InAppPurchaseState.MissingMetadata ||
      this.state === InAppPurchaseState.Rejected ||
      this.state === InAppPurchaseState.DeveloperActionNeeded
    );
  }
  get isPendingReview(): boolean {
    return this.state === InAppPurchaseState.WaitingForReview || this.state === InAppPurchaseState.InReview;
  }
  get isReadyToSubmit(): boolean { return this.state === InAppPurchaseState.ReadyToSubmit; }
  get isRejected(): boolean { return this.state === InAppPurchaseState.Rejected; }

  // ── Capability Checks (server-supplied affordances + state) ──

  get canSubmit(): boolean {
    return this.isReadyToSubmit && 'submit' in this.affordances;
  }

  get canUnsubmit(): boolean {
    return this.hasSubmission && 'unsubmit' in this.affordances;
  }

  get canDelete(): boolean {
    return 'delete' in this.affordances;
  }

  get canUpdate(): boolean {
    return this.isEditable && 'update' in this.affordances;
  }

  get canViewLocalizations(): boolean { return 'listLocalizations' in this.affordances; }
  get canCreateLocalization(): boolean { return 'createLocalization' in this.affordances; }
  get canViewPricing(): boolean { return 'getPriceSchedule' in this.affordances; }
  get canSetPrice(): boolean { return 'setPrice' in this.affordances; }
  get canViewAvailability(): boolean { return 'getAvailability' in this.affordances; }
  get canSetAvailability(): boolean { return 'setAvailability' in this.affordances; }
  get canViewOfferCodes(): boolean { return 'listOfferCodes' in this.affordances; }
  get canCreateOfferCode(): boolean { return 'createOfferCode' in this.affordances; }
  get canViewReviewScreenshot(): boolean { return 'getReviewScreenshot' in this.affordances; }
  get canUploadReviewScreenshot(): boolean { return 'uploadReviewScreenshot' in this.affordances; }

  // ── Localization aggregation ──

  /** Number of localizations whose `isComplete` getter is true. The
   *  Submit-for-Review gate checks `completeLocalizationCount > 0`. */
  get completeLocalizationCount(): number {
    return this.localizations.filter((l) => l.isComplete).length;
  }

  /** True if at least one locale exists and has a non-empty name. */
  get hasAnyCompleteLocalization(): boolean {
    return this.completeLocalizationCount > 0;
  }

  /** True if any localization has a pending edit / new locale awaiting save. */
  get hasUnsavedLocalizationChanges(): boolean {
    return this.localizations.some((l) => l.isNew || l.hasUnsavedChanges);
  }

  // ── Offer code aggregation ──

  get activeOfferCodeCount(): number {
    return this.offerCodes.filter((c) => c.isActive).length;
  }

  // ── Display Getters ──

  get displayType(): string {
    switch (this.inAppPurchaseType) {
      case InAppPurchaseType.Consumable: return 'Consumable';
      case InAppPurchaseType.NonConsumable: return 'Non-Consumable';
      case InAppPurchaseType.NonRenewingSubscription: return 'Non-Renewing';
      default: return this.inAppPurchaseType;
    }
  }

  get statusLabel(): string {
    switch (this.state) {
      case InAppPurchaseState.MissingMetadata: return 'Missing Metadata';
      case InAppPurchaseState.ReadyToSubmit: return 'Ready to Submit';
      case InAppPurchaseState.WaitingForReview: return 'Waiting for Review';
      case InAppPurchaseState.InReview: return 'In Review';
      case InAppPurchaseState.DeveloperActionNeeded: return 'Action Needed';
      case InAppPurchaseState.PendingBinaryApproval: return 'Pending Binary';
      case InAppPurchaseState.Approved: return 'Approved';
      case InAppPurchaseState.DeveloperRemovedFromSale: return 'Removed by Developer';
      case InAppPurchaseState.RemovedFromSale: return 'Removed from Sale';
      case InAppPurchaseState.Rejected: return 'Rejected';
      default: return this.state;
    }
  }

  get statusTone(): 'success' | 'info' | 'warning' | 'danger' | 'neutral' {
    switch (this.state) {
      case InAppPurchaseState.Approved: return 'success';
      case InAppPurchaseState.WaitingForReview:
      case InAppPurchaseState.InReview:
      case InAppPurchaseState.PendingBinaryApproval: return 'info';
      case InAppPurchaseState.MissingMetadata:
      case InAppPurchaseState.DeveloperActionNeeded: return 'warning';
      case InAppPurchaseState.Rejected:
      case InAppPurchaseState.RemovedFromSale: return 'danger';
      default: return 'neutral';
    }
  }

  // ── Mutators ──

  /** Submit this IAP for App Store review. Gate on canSubmit; the call sets
   *  hasSubmission=true and flips state to WaitingForReview to match what the
   *  backend will return on the next refresh. */
  async submit(): Promise<void> {
    if (!this.canSubmit) {
      throw new Error(`IAP ${this.id} cannot submit (state=${this.state})`);
    }
    await this.requireRepo().submit(this);
    runInAction(() => {
      this.hasSubmission = true;
      this.state = InAppPurchaseState.WaitingForReview;
    });
  }

  /** Cancel a pending review submission. Reverts state to ReadyToSubmit. */
  async unsubmit(): Promise<void> {
    if (!this.canUnsubmit) {
      throw new Error(`IAP ${this.id} has no active submission to cancel`);
    }
    await this.requireRepo().unsubmit(this);
    runInAction(() => {
      this.hasSubmission = false;
      this.state = InAppPurchaseState.ReadyToSubmit;
    });
  }

  /** Update editable fields (referenceName + reviewNote). Local mutation
   *  happens after the PATCH succeeds so a failure leaves state untouched. */
  async update(patch: { referenceName?: string; reviewNote?: string | null }): Promise<void> {
    if (!this.canUpdate) {
      throw new Error(`IAP ${this.id} is not editable (state=${this.state})`);
    }
    await this.requireRepo().update(this, patch);
    runInAction(() => {
      if (patch.referenceName !== undefined) this.referenceName = patch.referenceName;
      if (patch.reviewNote !== undefined) this.reviewNote = patch.reviewNote;
    });
  }

  // ── Localization navigation (mutating) ──

  /** Load all localizations for this IAP. Replaces `localizations` and
   *  attaches the repo to each child so they can save/delete themselves.
   *  Short-circuits to `[]` when the affordance is missing. */
  async loadLocalizations(): Promise<InAppPurchaseLocalization[]> {
    if (!this.canViewLocalizations) {
      runInAction(() => {
        this.localizations = [];
        this.isLocalizationsLoaded = true;
      });
      return [];
    }
    const repo = this.requireRepo();
    const list = await repo.localizations(this);
    runInAction(() => {
      list.forEach((l) => l.setRepository(repo));
      this.localizations = list;
      this.isLocalizationsLoaded = true;
    });
    return list;
  }

  /** Create a localization on the backend, attach the repo, append to
   *  `localizations`. Throws (and does not mutate) when the affordance
   *  is missing. */
  async addLocalization(input: { locale: string; name: string; description?: string | null }): Promise<InAppPurchaseLocalization> {
    if (!this.canCreateLocalization) {
      throw new Error(`IAP ${this.id} cannot create a localization (no createLocalization affordance)`);
    }
    const repo = this.requireRepo();
    const created = await repo.createLocalization(this, input);
    runInAction(() => {
      created.setRepository(repo);
      this.localizations = [...this.localizations, created];
    });
    return created;
  }

  /** Delete a localization through its own self-persistence and prune the
   *  list. The locale's `canDelete` is checked at the page boundary. */
  async removeLocalization(loc: InAppPurchaseLocalization): Promise<void> {
    if (!loc.canDelete) {
      throw new Error(`Localization ${loc.locale} cannot be deleted (no delete affordance)`);
    }
    await loc.delete();
    runInAction(() => {
      this.localizations = this.localizations.filter((l) => l !== loc);
    });
  }

  // ── Review (notes + screenshot) ──

  /** Save the review note for App Review. Reuses the same `update`
   *  affordance gate as `update()` since it's the same PATCH endpoint. */
  async updateReviewNote(note: string | null): Promise<void> {
    if (!('update' in this.affordances)) {
      throw new Error(`IAP ${this.id} cannot update review note (no update affordance)`);
    }
    await this.requireRepo().update(this, { reviewNote: note });
    runInAction(() => { this.reviewNote = note; });
  }

  /** Lazy-load the review screenshot. Short-circuits to null when the
   *  affordance is missing. */
  async loadReviewScreenshot(): Promise<ReviewScreenshot | null> {
    if (!this.canViewReviewScreenshot) {
      runInAction(() => {
        this.reviewScreenshot = null;
        this.isReviewScreenshotLoaded = true;
      });
      return null;
    }
    const fetched = await this.requireRepo().reviewScreenshot(this);
    runInAction(() => {
      this.reviewScreenshot = fetched;
      this.isReviewScreenshotLoaded = true;
    });
    return fetched;
  }

  /** Replace the existing screenshot (if any) with a new upload. Apple's
   *  resource is one-to-one — uploading while one already exists deletes
   *  the previous first so the page doesn't have to orchestrate. */
  async uploadReviewScreenshot(file: File): Promise<ReviewScreenshot> {
    if (!this.canUploadReviewScreenshot) {
      throw new Error(`IAP ${this.id} cannot upload review screenshot (no uploadReviewScreenshot affordance)`);
    }
    const repo = this.requireRepo();
    if (this.reviewScreenshot && this.reviewScreenshot.canDelete) {
      await repo.deleteReviewScreenshot(this, this.reviewScreenshot);
    }
    const created = await repo.uploadReviewScreenshot(this, file);
    runInAction(() => {
      this.reviewScreenshot = created;
      this.isReviewScreenshotLoaded = true;
    });
    return created;
  }

  // ── Offer codes ──

  async createOfferCode(input: { name: string; customerEligibilities: IAPCustomerEligibility[] }): Promise<InAppPurchaseOfferCode> {
    if (!this.canCreateOfferCode) {
      throw new Error(`IAP ${this.id} cannot create offer code (no createOfferCode affordance)`);
    }
    const repo = this.requireRepo();
    const created = await repo.createOfferCode(this, input);
    runInAction(() => {
      created.setRepository(repo);
      this.offerCodes = [...this.offerCodes, created];
    });
    return created;
  }

  async loadOfferCodes(): Promise<InAppPurchaseOfferCode[]> {
    if (!this.canViewOfferCodes) {
      runInAction(() => {
        this.offerCodes = [];
        this.isOfferCodesLoaded = true;
      });
      return [];
    }
    const repo = this.requireRepo();
    const list = await repo.offerCodes(this);
    runInAction(() => {
      list.forEach((c) => c.setRepository(repo));
      this.offerCodes = list;
      this.isOfferCodesLoaded = true;
    });
    return list;
  }

  // ── Availability ──

  /** Load the IAP's availability. Short-circuits to null when the affordance
   *  is missing. */
  async loadAvailability(): Promise<IAPAvailability | null> {
    if (!this.canViewAvailability) {
      runInAction(() => {
        this.availability = null;
        this.isAvailabilityLoaded = true;
      });
      return null;
    }
    const fetched = await this.requireRepo().availability(this);
    runInAction(() => {
      this.availability = fetched;
      this.isAvailabilityLoaded = true;
    });
    return fetched;
  }

  /** Persist the user's pending availability edits. The page mutates
   *  `availability` in place and calls this to flush. Snapshots the saved
   *  state so `isDirty` reverts to false. */
  async saveAvailability(): Promise<void> {
    if (!this.availability) {
      throw new Error(`IAP ${this.id} has no availability loaded`);
    }
    if (!this.canSetAvailability) {
      throw new Error(`IAP ${this.id} cannot set availability (no setAvailability affordance)`);
    }
    const avail = this.availability;
    await this.requireRepo().setAvailability(this, {
      territoryIds: avail.availableTerritoryIds,
      availableInNewTerritories: avail.availableInNewTerritories,
    });
    runInAction(() => avail.markSaved());
  }

  // ── Pricing ──

  /** Set the base price for this IAP and refetch the schedule so the page
   *  reflects Apple's auto-equalised territory prices. Gates on the
   *  setPrice affordance — callers should disable the button via
   *  `canSetPrice` but the throw is the safety net for programmer error. */
  async setPrice(input: { territoryId: string; pricePointId: string }): Promise<void> {
    if (!this.canSetPrice) {
      throw new Error(`IAP ${this.id} cannot set price (no setPrice affordance)`);
    }
    await this.requireRepo().setPrice(this, input);
    await this.loadPriceSchedule();
  }

  /** Load the IAP's price schedule. Short-circuits to null when the
   *  affordance is missing (newly created IAPs sometimes don't expose it
   *  until pricing is set). */
  async loadPriceSchedule(): Promise<IAPPriceSchedule | null> {
    if (!this.canViewPricing) {
      runInAction(() => {
        this.priceSchedule = null;
        this.isPriceScheduleLoaded = true;
      });
      return null;
    }
    const fetched = await this.requireRepo().priceSchedule(this);
    runInAction(() => {
      this.priceSchedule = fetched;
      this.isPriceScheduleLoaded = true;
    });
    return fetched;
  }

  async deleteReviewScreenshot(): Promise<void> {
    if (!this.reviewScreenshot) {
      throw new Error(`IAP ${this.id} has no review screenshot to delete`);
    }
    if (!this.reviewScreenshot.canDelete) {
      throw new Error(`IAP ${this.id} review screenshot cannot be deleted (no delete affordance)`);
    }
    await this.requireRepo().deleteReviewScreenshot(this, this.reviewScreenshot);
    runInAction(() => { this.reviewScreenshot = null; });
  }

  setRepository(repo: InAppPurchaseRepository): void {
    this.repository = repo;
  }

  private requireRepo(): InAppPurchaseRepository {
    if (!this.repository) {
      throw new Error(`InAppPurchase ${this.id} has no repository attached`);
    }
    return this.repository;
  }

  // ── Helpers ──

  /** Suggest a default product ID from a bundle ID + reference name in the
   *  shape the iOS prototype shows ("com.app.gempack"). The bundle ID's
   *  last segment is replaced (or appended) with the slug, so
   *  `com.example.weather` + `Premium Upgrade` → `com.example.premium_upgrade`.
   *  Empty inputs fall back to the bundle ID itself. */
  static suggestedProductId(bundleId: string, referenceName: string): string {
    const slug = referenceName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    if (!slug) return bundleId;
    if (!bundleId) return slug;
    const segments = bundleId.split('.');
    if (segments.length <= 1) return `${bundleId}.${slug}`;
    segments[segments.length - 1] = slug;
    return segments.join('.');
  }

  // ── Factory ──

  static fromJSON(json: Record<string, unknown>, repo?: InAppPurchaseRepository): InAppPurchase {
    const submission = json.submission;
    const hasSubmission =
      typeof json.hasSubmission === 'boolean'
        ? (json.hasSubmission as boolean)
        : submission !== undefined && submission !== null;

    return new InAppPurchase(
      {
        id: (json.id as string) ?? '',
        appId: (json.appId as string) ?? '',
        referenceName: ((json.referenceName as string) ?? (json.name as string)) ?? '',
        productId: (json.productId as string) ?? '',
        inAppPurchaseType: ((json.inAppPurchaseType as string) ?? (json.type as string)) ?? '',
        state: (json.state as string) ?? '',
        reviewNote: (json.reviewNote as string | null | undefined) ?? null,
        hasSubmission,
        affordances: (json.affordances as Affordances) ?? {},
      },
      repo ?? null,
    );
  }
}
