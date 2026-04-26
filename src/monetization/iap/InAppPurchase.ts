import { makeAutoObservable, runInAction } from 'mobx';
import type { Affordances } from '../../shared/types.ts';
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
  get canViewPricing(): boolean { return 'getPriceSchedule' in this.affordances; }
  get canViewAvailability(): boolean { return 'getAvailability' in this.affordances; }
  get canViewOfferCodes(): boolean { return 'listOfferCodes' in this.affordances; }

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
