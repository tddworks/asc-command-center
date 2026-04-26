import { makeAutoObservable, runInAction } from 'mobx';
import type { Affordances } from '../../shared/types.ts';
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

  // ── Capability Checks ──

  get canSubmit(): boolean {
    return this.isReadyToSubmit && 'submit' in this.affordances;
  }
  get canUnsubmit(): boolean {
    return this.hasSubmission && 'unsubmit' in this.affordances;
  }
  get canDelete(): boolean { return 'delete' in this.affordances; }
  get canUpdate(): boolean { return this.isEditable && 'update' in this.affordances; }

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

  setRepository(repo: SubscriptionRepository): void {
    this.repository = repo;
  }

  private requireRepo(): SubscriptionRepository {
    if (!this.repository) {
      throw new Error(`Subscription ${this.id} has no repository attached`);
    }
    return this.repository;
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
