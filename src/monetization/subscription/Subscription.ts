import { makeAutoObservable, runInAction } from 'mobx';
import type { Affordances } from '../../shared/types.ts';
import { SubscriptionLocalization } from './SubscriptionLocalization.ts';
import type { SubscriptionAvailability } from './SubscriptionAvailability.ts';
import type { SubscriptionPriceSchedule } from './SubscriptionPriceSchedule.ts';
import type { SubscriptionPricePointPage } from './SubscriptionPricePoint.ts';
import type { SubscriptionReviewScreenshot } from './SubscriptionReviewScreenshot.ts';
import type {
  OfferMode,
  SubscriptionCustomerEligibility,
  SubscriptionDuration,
  SubscriptionIntroductoryOffer,
  SubscriptionOfferCode,
  SubscriptionPromotionalOffer,
} from './SubscriptionOffers.ts';
import type { WinBackOffer } from './WinBackOffer.ts';
import type { SubscriptionRepository } from './SubscriptionRepository.ts';

export const SubscriptionPeriod = {
  OneWeek: 'ONE_WEEK',
  OneMonth: 'ONE_MONTH',
  TwoMonths: 'TWO_MONTHS',
  ThreeMonths: 'THREE_MONTHS',
  SixMonths: 'SIX_MONTHS',
  OneYear: 'ONE_YEAR',
} as const;
export type SubscriptionPeriod = typeof SubscriptionPeriod[keyof typeof SubscriptionPeriod];

export const SubscriptionState = {
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
export type SubscriptionState = typeof SubscriptionState[keyof typeof SubscriptionState];

export interface SubscriptionInit {
  id: string;
  groupId: string;
  name: string;
  productId: string;
  subscriptionPeriod: SubscriptionPeriod | string;
  isFamilySharable: boolean;
  state: SubscriptionState | string;
  groupLevel?: number | null;
  reviewNote?: string | null;
  hasSubmission?: boolean;
  affordances: Affordances;
}

/**
 * Subscription — auto-renewable tier within a SubscriptionGroup.
 * Mirrors the Swift SDK class with state-based semantic booleans, capability
 * checks (delete/submit/unsubmit), and update/submit mutators. Child
 * resources (localizations, pricing, intro/promo offers, offer codes) ship
 * in their own slices later.
 */
export class Subscription {
  readonly id: string;
  readonly groupId: string;
  name: string;
  readonly productId: string;
  subscriptionPeriod: string;
  isFamilySharable: boolean;
  state: string;
  groupLevel: number | null;
  reviewNote: string | null;
  hasSubmission: boolean;
  affordances: Affordances;

  /** Localizations loaded for this tier (empty until `loadLocalizations()`). */
  localizations: SubscriptionLocalization[] = [];
  /** True once `loadLocalizations()` has resolved. */
  isLocalizationsLoaded = false;

  /** Pricing snapshot, or null when never loaded / no schedule exists. */
  priceSchedule: SubscriptionPriceSchedule | null = null;
  isPriceScheduleLoaded = false;

  /** Currently uploaded review screenshot, or null when none exists. */
  reviewScreenshot: SubscriptionReviewScreenshot | null = null;
  isReviewScreenshotLoaded = false;

  /** Territory availability + auto-include flag. Null until loaded. */
  availability: SubscriptionAvailability | null = null;
  isAvailabilityLoaded = false;

  introductoryOffers: SubscriptionIntroductoryOffer[] = [];
  isIntroductoryOffersLoaded = false;

  promotionalOffers: SubscriptionPromotionalOffer[] = [];
  isPromotionalOffersLoaded = false;

  offerCodes: SubscriptionOfferCode[] = [];
  isOfferCodesLoaded = false;

  winBackOffers: WinBackOffer[] = [];
  isWinBackOffersLoaded = false;

  repository: SubscriptionRepository | null;

  constructor(init: SubscriptionInit, repository: SubscriptionRepository | null = null) {
    this.id = init.id;
    this.groupId = init.groupId;
    this.name = init.name;
    this.productId = init.productId;
    this.subscriptionPeriod = init.subscriptionPeriod;
    this.isFamilySharable = init.isFamilySharable;
    this.state = init.state;
    this.groupLevel = init.groupLevel ?? null;
    this.reviewNote = init.reviewNote ?? null;
    this.hasSubmission = init.hasSubmission ?? false;
    this.affordances = init.affordances;
    this.repository = repository;

    makeAutoObservable(this, { id: false, groupId: false, productId: false, repository: false });
  }

  // ── Semantic Booleans ──

  get isApproved(): boolean { return this.state === SubscriptionState.Approved; }
  get isLive(): boolean { return this.isApproved; }
  get isEditable(): boolean {
    return (
      this.state === SubscriptionState.MissingMetadata ||
      this.state === SubscriptionState.Rejected ||
      this.state === SubscriptionState.DeveloperActionNeeded ||
      this.state === SubscriptionState.ReadyToSubmit
    );
  }
  get isPendingReview(): boolean {
    return this.state === SubscriptionState.WaitingForReview || this.state === SubscriptionState.InReview;
  }
  get isReadyToSubmit(): boolean { return this.state === SubscriptionState.ReadyToSubmit; }
  get isRejected(): boolean { return this.state === SubscriptionState.Rejected; }

  /** True when the tier is in a state that needs developer action to make
   *  progress. Excludes `ReadyToSubmit` — that state is *waiting on the
   *  user to click Submit*, not blocked on missing fields. The needs-action
   *  banner gates on this. */
  get needsAttention(): boolean {
    return (
      this.state === SubscriptionState.MissingMetadata ||
      this.state === SubscriptionState.Rejected ||
      this.state === SubscriptionState.DeveloperActionNeeded
    );
  }

  // ── Capability Checks ──

  get canSubmit(): boolean {
    return this.isReadyToSubmit && 'submit' in this.affordances;
  }
  get canUnsubmit(): boolean {
    return this.hasSubmission && 'unsubmit' in this.affordances;
  }
  get canDelete(): boolean { return 'delete' in this.affordances; }
  get canUpdate(): boolean { return this.isEditable && 'update' in this.affordances; }
  get canViewLocalizations(): boolean { return 'listLocalizations' in this.affordances; }
  get canCreateLocalization(): boolean { return 'createLocalization' in this.affordances; }
  get canViewPricing(): boolean { return 'getPriceSchedule' in this.affordances; }
  get canSetPrices(): boolean { return 'setPrices' in this.affordances; }
  get canViewReviewScreenshot(): boolean { return 'getReviewScreenshot' in this.affordances; }
  get canUploadReviewScreenshot(): boolean { return 'uploadReviewScreenshot' in this.affordances; }
  get canViewAvailability(): boolean { return 'getAvailability' in this.affordances; }
  get canSetAvailability(): boolean { return 'setAvailability' in this.affordances; }
  get canViewIntroductoryOffers(): boolean { return 'listIntroductoryOffers' in this.affordances; }
  get canViewPromotionalOffers(): boolean { return 'listPromotionalOffers' in this.affordances; }
  get canViewOfferCodes(): boolean { return 'listOfferCodes' in this.affordances; }
  get canCreateOfferCode(): boolean { return 'createOfferCode' in this.affordances; }
  /** Win-back offers gate on Apple's "subscription approved" + the affordance.
   *  Page renders a "requires approval" landing card when the second is true
   *  but the first isn't yet. */
  get canViewWinBackOffers(): boolean {
    return this.isApproved && 'listWinBackOffers' in this.affordances;
  }
  get canCreateIntroductoryOffer(): boolean { return 'createIntroductoryOffer' in this.affordances; }
  get canCreatePromotionalOffer(): boolean { return 'createPromotionalOffer' in this.affordances; }

  // ── Localization aggregation ──

  get completeLocalizationCount(): number {
    return this.localizations.filter((l) => l.isComplete).length;
  }

  get hasAnyCompleteLocalization(): boolean {
    return this.completeLocalizationCount > 0;
  }

  get hasUnsavedLocalizationChanges(): boolean {
    return this.localizations.some((l) => l.isNew || l.hasUnsavedChanges);
  }

  // ── Display ──

  get periodLabel(): string {
    switch (this.subscriptionPeriod) {
      case SubscriptionPeriod.OneWeek: return '1 Week';
      case SubscriptionPeriod.OneMonth: return '1 Month';
      case SubscriptionPeriod.TwoMonths: return '2 Months';
      case SubscriptionPeriod.ThreeMonths: return '3 Months';
      case SubscriptionPeriod.SixMonths: return '6 Months';
      case SubscriptionPeriod.OneYear: return '1 Year';
      default: return this.subscriptionPeriod;
    }
  }

  get statusLabel(): string {
    switch (this.state) {
      case SubscriptionState.MissingMetadata: return 'Missing Metadata';
      case SubscriptionState.ReadyToSubmit: return 'Ready to Submit';
      case SubscriptionState.WaitingForReview: return 'Waiting for Review';
      case SubscriptionState.InReview: return 'In Review';
      case SubscriptionState.DeveloperActionNeeded: return 'Action Needed';
      case SubscriptionState.PendingBinaryApproval: return 'Pending Binary';
      case SubscriptionState.Approved: return 'Approved';
      case SubscriptionState.DeveloperRemovedFromSale: return 'Removed by Developer';
      case SubscriptionState.RemovedFromSale: return 'Removed from Sale';
      case SubscriptionState.Rejected: return 'Rejected';
      default: return this.state;
    }
  }

  get statusTone(): 'success' | 'info' | 'warning' | 'danger' | 'neutral' {
    switch (this.state) {
      case SubscriptionState.Approved: return 'success';
      case SubscriptionState.WaitingForReview:
      case SubscriptionState.InReview:
      case SubscriptionState.PendingBinaryApproval: return 'info';
      case SubscriptionState.MissingMetadata:
      case SubscriptionState.DeveloperActionNeeded: return 'warning';
      case SubscriptionState.Rejected:
      case SubscriptionState.RemovedFromSale: return 'danger';
      default: return 'neutral';
    }
  }

  // ── Mutators ──

  async submit(): Promise<void> {
    if (!this.canSubmit) {
      throw new Error(`Subscription ${this.id} cannot submit (state=${this.state})`);
    }
    await this.requireRepo().submit(this);
    runInAction(() => {
      this.hasSubmission = true;
      this.state = SubscriptionState.WaitingForReview;
    });
  }

  async unsubmit(): Promise<void> {
    if (!this.canUnsubmit) {
      throw new Error(`Subscription ${this.id} has no active submission to cancel`);
    }
    await this.requireRepo().unsubmit(this);
    runInAction(() => {
      this.hasSubmission = false;
      this.state = SubscriptionState.ReadyToSubmit;
    });
  }

  async update(patch: {
    name?: string;
    subscriptionPeriod?: SubscriptionPeriod | string;
    isFamilySharable?: boolean;
    groupLevel?: number | null;
    reviewNote?: string | null;
  }): Promise<void> {
    if (!this.canUpdate) {
      throw new Error(`Subscription ${this.id} is not editable (state=${this.state})`);
    }
    await this.requireRepo().update(this, patch);
    runInAction(() => {
      if (patch.name !== undefined) this.name = patch.name;
      if (patch.subscriptionPeriod !== undefined) this.subscriptionPeriod = patch.subscriptionPeriod;
      if (patch.isFamilySharable !== undefined) this.isFamilySharable = patch.isFamilySharable;
      if (patch.groupLevel !== undefined) this.groupLevel = patch.groupLevel;
      if (patch.reviewNote !== undefined) this.reviewNote = patch.reviewNote;
    });
  }

  // ── Localization navigation (mutating) ──

  async loadLocalizations(): Promise<SubscriptionLocalization[]> {
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

  async addLocalization(input: { locale: string; name: string; description?: string | null }): Promise<SubscriptionLocalization> {
    if (!this.canCreateLocalization) {
      throw new Error(`Subscription ${this.id} cannot create a localization (no createLocalization affordance)`);
    }
    const repo = this.requireRepo();
    const created = await repo.createLocalization(this, input);
    runInAction(() => {
      created.setRepository(repo);
      this.localizations = [...this.localizations, created];
    });
    return created;
  }

  // ── Review (notes + screenshot) ──

  async updateReviewNote(note: string | null): Promise<void> {
    if (!this.canUpdate) {
      throw new Error(`Subscription ${this.id} cannot update review note (not editable or no update affordance)`);
    }
    await this.requireRepo().update(this, { reviewNote: note });
    runInAction(() => { this.reviewNote = note; });
  }

  async loadReviewScreenshot(): Promise<SubscriptionReviewScreenshot | null> {
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

  async uploadReviewScreenshot(file: File): Promise<SubscriptionReviewScreenshot> {
    if (!this.canUploadReviewScreenshot) {
      throw new Error(`Subscription ${this.id} cannot upload review screenshot (no uploadReviewScreenshot affordance)`);
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

  async deleteReviewScreenshot(): Promise<void> {
    if (!this.reviewScreenshot) {
      throw new Error(`Subscription ${this.id} has no review screenshot to delete`);
    }
    if (!this.reviewScreenshot.canDelete) {
      throw new Error(`Subscription ${this.id} review screenshot cannot be deleted (no delete affordance)`);
    }
    await this.requireRepo().deleteReviewScreenshot(this, this.reviewScreenshot);
    runInAction(() => { this.reviewScreenshot = null; });
  }

  // ── Offers ──

  async loadIntroductoryOffers(): Promise<SubscriptionIntroductoryOffer[]> {
    if (!this.canViewIntroductoryOffers) {
      runInAction(() => {
        this.introductoryOffers = [];
        this.isIntroductoryOffersLoaded = true;
      });
      return [];
    }
    const list = await this.requireRepo().introductoryOffers(this);
    runInAction(() => {
      this.introductoryOffers = list;
      this.isIntroductoryOffersLoaded = true;
    });
    return list;
  }

  async loadPromotionalOffers(): Promise<SubscriptionPromotionalOffer[]> {
    if (!this.canViewPromotionalOffers) {
      runInAction(() => {
        this.promotionalOffers = [];
        this.isPromotionalOffersLoaded = true;
      });
      return [];
    }
    const list = await this.requireRepo().promotionalOffers(this);
    runInAction(() => {
      this.promotionalOffers = list;
      this.isPromotionalOffersLoaded = true;
    });
    return list;
  }

  async createIntroductoryOffer(input: {
    offerMode: OfferMode | string;
    duration: SubscriptionDuration | string;
    numberOfPeriods: number;
    territory?: string | null;
    startDate?: string | null;
    endDate?: string | null;
  }): Promise<SubscriptionIntroductoryOffer> {
    if (!this.canCreateIntroductoryOffer) {
      throw new Error(`Subscription ${this.id} cannot create introductory offer (no createIntroductoryOffer affordance)`);
    }
    const created = await this.requireRepo().createIntroductoryOffer(this, input);
    runInAction(() => { this.introductoryOffers = [...this.introductoryOffers, created]; });
    return created;
  }

  async deleteIntroductoryOffer(offer: SubscriptionIntroductoryOffer): Promise<void> {
    await this.requireRepo().deleteIntroductoryOffer(offer);
    runInAction(() => {
      this.introductoryOffers = this.introductoryOffers.filter((o) => o !== offer);
    });
  }

  async createPromotionalOffer(input: {
    name: string;
    offerCode: string;
    offerMode: OfferMode | string;
    duration: SubscriptionDuration | string;
    numberOfPeriods: number;
  }): Promise<SubscriptionPromotionalOffer> {
    if (!this.canCreatePromotionalOffer) {
      throw new Error(`Subscription ${this.id} cannot create promotional offer (no createPromotionalOffer affordance)`);
    }
    const created = await this.requireRepo().createPromotionalOffer(this, input);
    runInAction(() => { this.promotionalOffers = [...this.promotionalOffers, created]; });
    return created;
  }

  async deletePromotionalOffer(offer: SubscriptionPromotionalOffer): Promise<void> {
    await this.requireRepo().deletePromotionalOffer(offer);
    runInAction(() => {
      this.promotionalOffers = this.promotionalOffers.filter((o) => o !== offer);
    });
  }

  async loadWinBackOffers(): Promise<WinBackOffer[]> {
    if (!this.canViewWinBackOffers) {
      runInAction(() => {
        this.winBackOffers = [];
        this.isWinBackOffersLoaded = true;
      });
      return [];
    }
    const list = await this.requireRepo().winBackOffers(this);
    runInAction(() => {
      this.winBackOffers = list;
      this.isWinBackOffersLoaded = true;
    });
    return list;
  }

  async createOfferCode(input: {
    name: string;
    offerMode: OfferMode | string;
    duration: SubscriptionDuration | string;
    numberOfPeriods: number;
    customerEligibilities: SubscriptionCustomerEligibility[];
  }): Promise<SubscriptionOfferCode> {
    if (!this.canCreateOfferCode) {
      throw new Error(`Subscription ${this.id} cannot create offer code (no createOfferCode affordance)`);
    }
    const created = await this.requireRepo().createOfferCode(this, input);
    runInAction(() => {
      this.offerCodes = [...this.offerCodes, created];
    });
    return created;
  }

  async loadOfferCodes(): Promise<SubscriptionOfferCode[]> {
    if (!this.canViewOfferCodes) {
      runInAction(() => {
        this.offerCodes = [];
        this.isOfferCodesLoaded = true;
      });
      return [];
    }
    const list = await this.requireRepo().offerCodes(this);
    runInAction(() => {
      this.offerCodes = list;
      this.isOfferCodesLoaded = true;
    });
    return list;
  }

  // ── Availability ──

  async loadAvailability(): Promise<SubscriptionAvailability | null> {
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

  async saveAvailability(): Promise<void> {
    if (!this.availability) {
      throw new Error(`Subscription ${this.id} has no availability loaded`);
    }
    if (!this.canSetAvailability) {
      throw new Error(`Subscription ${this.id} cannot set availability (no setAvailability affordance)`);
    }
    const avail = this.availability;
    await this.requireRepo().setAvailability(this, {
      territoryIds: avail.availableTerritoryIds,
      availableInNewTerritories: avail.availableInNewTerritories,
    });
    runInAction(() => avail.markSaved());
  }

  // ── Pricing ──

  async loadPricePoints(input: { territoryId: string; cursor: string | null; limit?: number }): Promise<SubscriptionPricePointPage> {
    return this.requireRepo().pricePoints(this, input);
  }

  async loadEqualizations(input: { pricePointId: string; cursor: string | null; limit?: number }): Promise<SubscriptionPricePointPage> {
    return this.requireRepo().equalizations(this, input);
  }

  /** Set prices for one or more territories. Apple equalises the rest off
   *  the passed list, so a single-territory input usually suffices. We
   *  refetch the schedule so the page reflects the equalised rows. */
  async setPrices(input: Array<{ territoryId: string; pricePointId: string }>): Promise<void> {
    if (!this.canSetPrices) {
      throw new Error(`Subscription ${this.id} cannot set prices (no setPrices affordance)`);
    }
    await this.requireRepo().setPrices(this, input);
    await this.loadPriceSchedule();
  }

  async loadPriceSchedule(): Promise<SubscriptionPriceSchedule | null> {
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

  async removeLocalization(loc: SubscriptionLocalization): Promise<void> {
    if (!loc.canDelete) {
      throw new Error(`Localization ${loc.locale} cannot be deleted (no delete affordance)`);
    }
    await loc.delete();
    runInAction(() => {
      this.localizations = this.localizations.filter((l) => l !== loc);
    });
  }

  setRepository(repo: SubscriptionRepository): void {
    this.repository = repo;
  }

  private requireRepo(): SubscriptionRepository {
    if (!this.repository) {
      throw new Error(`Subscription ${this.id} has no repository attached`);
    }
    return this.repository;
  }

  // ── Helpers ──

  /** Suggest a default product ID from a bundle ID + display name in the
   *  shape the iOS prototype shows ("com.app.weekly"). Identical slugging
   *  rules as `InAppPurchase.suggestedProductId`. */
  static suggestedProductId(bundleId: string, displayName: string): string {
    const slug = displayName
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

  static fromJSON(json: Record<string, unknown>, repo?: SubscriptionRepository): Subscription {
    const submission = json.submission;
    const hasSubmission =
      typeof json.hasSubmission === 'boolean'
        ? (json.hasSubmission as boolean)
        : submission !== undefined && submission !== null;

    return new Subscription(
      {
        id: (json.id as string) ?? '',
        groupId: ((json.groupId as string) ?? (json.subscriptionGroupId as string)) ?? '',
        name: ((json.name as string) ?? (json.referenceName as string)) ?? '',
        productId: (json.productId as string) ?? '',
        subscriptionPeriod: ((json.subscriptionPeriod as string) ?? (json.period as string)) ?? '',
        isFamilySharable: (json.isFamilySharable as boolean) ?? false,
        state: (json.state as string) ?? '',
        groupLevel: (json.groupLevel as number | null | undefined) ?? null,
        reviewNote: (json.reviewNote as string | null | undefined) ?? null,
        hasSubmission,
        affordances: (json.affordances as Affordances) ?? {},
      },
      repo ?? null,
    );
  }
}
