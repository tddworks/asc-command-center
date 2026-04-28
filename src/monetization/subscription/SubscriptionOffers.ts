import { makeAutoObservable, runInAction } from 'mobx';
import type { Affordances } from '../../shared/types.ts';
import type { SubscriptionRepository } from './SubscriptionRepository.ts';

/** Environment for offer-code batches (production vs sandbox). Mirrors
 *  iOS's `OfferCodeEnvironment` and the IAP slice's `CodeEnvironment`. */
export const CodeEnvironment = {
  Production: 'PRODUCTION',
  Sandbox: 'SANDBOX',
} as const;
export type CodeEnvironment = typeof CodeEnvironment[keyof typeof CodeEnvironment];

/** Offer pricing mode — Apple's three buckets. Same enum is used by all
 *  three offer variants (intro, promo, code). */
export const OfferMode = {
  FreeTrial: 'FREE_TRIAL',
  PayAsYouGo: 'PAY_AS_YOU_GO',
  PayUpFront: 'PAY_UP_FRONT',
} as const;
export type OfferMode = typeof OfferMode[keyof typeof OfferMode];

const OFFER_MODE_LABELS: Record<string, string> = {
  [OfferMode.FreeTrial]: 'Free Trial',
  [OfferMode.PayAsYouGo]: 'Pay as You Go',
  [OfferMode.PayUpFront]: 'Pay Up Front',
};

/** Offer duration unit — same six options Apple supports for subscription
 *  billing periods. */
export const SubscriptionDuration = {
  OneWeek: 'ONE_WEEK',
  OneMonth: 'ONE_MONTH',
  TwoMonths: 'TWO_MONTHS',
  ThreeMonths: 'THREE_MONTHS',
  SixMonths: 'SIX_MONTHS',
  OneYear: 'ONE_YEAR',
} as const;
export type SubscriptionDuration = typeof SubscriptionDuration[keyof typeof SubscriptionDuration];

const DURATION_LABELS: Record<string, string> = {
  [SubscriptionDuration.OneWeek]: '1 Week',
  [SubscriptionDuration.OneMonth]: '1 Month',
  [SubscriptionDuration.TwoMonths]: '2 Months',
  [SubscriptionDuration.ThreeMonths]: '3 Months',
  [SubscriptionDuration.SixMonths]: '6 Months',
  [SubscriptionDuration.OneYear]: '1 Year',
};

function offerSummary(mode: string, duration: string, periods: number): string {
  const modeLabel = OFFER_MODE_LABELS[mode] ?? mode;
  const durationLabel = DURATION_LABELS[duration] ?? duration;
  return periods === 1
    ? `${modeLabel} · ${durationLabel}`
    : `${modeLabel} · ${periods} × ${durationLabel}`;
}

// ── Introductory Offer ──

export interface SubscriptionIntroductoryOfferInit {
  id: string;
  offerMode: OfferMode | string;
  duration: SubscriptionDuration | string;
  numberOfPeriods: number;
  territory?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  customerPrice?: string | null;
  proceeds?: string | null;
}

/**
 * Time-limited promotional pricing for net-new or expired subscribers.
 * Only one intro offer per (territory, subscription) pair is allowed by
 * Apple, so there's no `name` field — just the mode/duration/periods.
 */
export class SubscriptionIntroductoryOffer {
  readonly id: string;
  readonly offerMode: string;
  readonly duration: string;
  readonly numberOfPeriods: number;
  readonly territory: string | null;
  readonly startDate: string | null;
  readonly endDate: string | null;
  readonly customerPrice: string | null;
  readonly proceeds: string | null;

  constructor(init: SubscriptionIntroductoryOfferInit) {
    this.id = init.id;
    this.offerMode = init.offerMode;
    this.duration = init.duration;
    this.numberOfPeriods = init.numberOfPeriods;
    this.territory = init.territory ?? null;
    this.startDate = init.startDate ?? null;
    this.endDate = init.endDate ?? null;
    this.customerPrice = init.customerPrice ?? null;
    this.proceeds = init.proceeds ?? null;

    makeAutoObservable(this);
  }

  get isFreeTrial(): boolean { return this.offerMode === OfferMode.FreeTrial; }

  get summaryLabel(): string { return offerSummary(this.offerMode, this.duration, this.numberOfPeriods); }

  static fromJSON(json: Record<string, unknown>): SubscriptionIntroductoryOffer {
    return new SubscriptionIntroductoryOffer({
      id: (json.id as string) ?? '',
      offerMode: ((json.offerMode as string) ?? (json.mode as string)) ?? '',
      duration: (json.duration as string) ?? '',
      numberOfPeriods:
        (json.numberOfPeriods as number) ??
        (json.periods as number) ??
        1,
      territory: (json.territory as string | null | undefined) ?? null,
      startDate: (json.startDate as string | null | undefined) ?? null,
      endDate: (json.endDate as string | null | undefined) ?? null,
      customerPrice: (json.customerPrice as string | null | undefined) ?? null,
      proceeds: (json.proceeds as string | null | undefined) ?? null,
    });
  }
}

// ── Promotional Offer ──

export interface SubscriptionPromotionalOfferInit {
  id: string;
  name: string;
  /** Stable identifier used in StoreKit calls (`offerCode` in Apple's
   *  payload, but it's not user-redeemable like an offer code is). */
  offerCode: string;
  offerMode: OfferMode | string;
  duration: SubscriptionDuration | string;
  numberOfPeriods: number;
  affordances?: Affordances;
}

/**
 * Existing-subscriber discount with a developer-defined identifier.
 * Different from offer codes — these are signed and presented in-app
 * via StoreKit, not redeemed via a URL.
 */
export class SubscriptionPromotionalOffer {
  readonly id: string;
  readonly name: string;
  readonly offerCode: string;
  readonly offerMode: string;
  readonly duration: string;
  readonly numberOfPeriods: number;
  affordances: Affordances;

  constructor(init: SubscriptionPromotionalOfferInit) {
    this.id = init.id;
    this.name = init.name;
    this.offerCode = init.offerCode;
    this.offerMode = init.offerMode;
    this.duration = init.duration;
    this.numberOfPeriods = init.numberOfPeriods;
    this.affordances = init.affordances ?? {};

    makeAutoObservable(this);
  }

  /** Alias to keep the name + identifier distinction explicit at call sites. */
  get identifier(): string { return this.offerCode; }

  get summaryLabel(): string { return offerSummary(this.offerMode, this.duration, this.numberOfPeriods); }

  static fromJSON(json: Record<string, unknown>): SubscriptionPromotionalOffer {
    return new SubscriptionPromotionalOffer({
      id: (json.id as string) ?? '',
      name: (json.name as string) ?? '',
      offerCode: ((json.offerCode as string) ?? (json.identifier as string)) ?? '',
      offerMode: ((json.offerMode as string) ?? (json.mode as string)) ?? '',
      duration: (json.duration as string) ?? '',
      numberOfPeriods:
        (json.numberOfPeriods as number) ??
        (json.periods as number) ??
        1,
      affordances: (json.affordances as Affordances | undefined) ?? {},
    });
  }
}

// ── Offer Code ──

export const SubscriptionCustomerEligibility = {
  New: 'NEW',
  Existing: 'EXISTING',
  Expired: 'EXPIRED',
} as const;
export type SubscriptionCustomerEligibility = typeof SubscriptionCustomerEligibility[keyof typeof SubscriptionCustomerEligibility];

/** Whether the offer code stacks with intro offers or replaces them. iOS
 *  drives this off the auto-renew + customer-eligibility combo; Apple's
 *  REST takes the explicit value. */
export const SubscriptionOfferEligibility = {
  StackWithIntroOffers: 'STACK_WITH_INTRO_OFFERS',
  ReplaceIntroOffers: 'REPLACE_INTRO_OFFERS',
} as const;
export type SubscriptionOfferEligibility = typeof SubscriptionOfferEligibility[keyof typeof SubscriptionOfferEligibility];

/** Per-territory pricing input for creating subscription offer codes —
 *  identical shape to IAP's. `pricePointId === null` means free in this
 *  territory (the rest get the picked anchor + Apple's equalisation). */
export interface SubscriptionOfferCodePriceInput {
  territory: string;
  pricePointId: string | null;
}

// ── Children ──

export interface SubscriptionCustomCodeInit {
  id: string;
  customCode: string;
  numberOfCodes: number;
  expirationDate?: string | null;
  isActive: boolean;
}

/** A developer-defined custom redeemable code attached to a subscription
 *  offer code. Same shape as `IAPCustomCode` but lives in the
 *  subscription bounded context. */
export class SubscriptionCustomCode {
  readonly id: string;
  readonly customCode: string;
  readonly numberOfCodes: number;
  readonly expirationDate: string | null;
  isActive: boolean;

  constructor(init: SubscriptionCustomCodeInit) {
    this.id = init.id;
    this.customCode = init.customCode;
    this.numberOfCodes = init.numberOfCodes;
    this.expirationDate = init.expirationDate ?? null;
    this.isActive = init.isActive;

    makeAutoObservable(this, {
      id: false, customCode: false, numberOfCodes: false, expirationDate: false,
    });
  }

  static fromJSON(json: Record<string, unknown>): SubscriptionCustomCode {
    return new SubscriptionCustomCode({
      id: (json.id as string) ?? '',
      customCode: (json.customCode as string) ?? '',
      numberOfCodes: (json.numberOfCodes as number) ?? 0,
      expirationDate: (json.expirationDate as string | null | undefined) ?? null,
      isActive: (json.isActive as boolean) ?? false,
    });
  }
}

export interface SubscriptionOneTimeUseCodeBatchInit {
  id: string;
  numberOfCodes: number;
  environment: CodeEnvironment | string;
  isActive: boolean;
  expirationDate?: string | null;
  createdDate?: string | null;
  createdBy?: string | null;
}

/** One generated batch of one-time-use codes. Production and sandbox
 *  batches both surface here — the parent `oneTimeUseCodes` collection
 *  is filtered by environment in the UI. */
export class SubscriptionOneTimeUseCodeBatch {
  readonly id: string;
  readonly numberOfCodes: number;
  readonly environment: string;
  isActive: boolean;
  readonly expirationDate: string | null;
  readonly createdDate: string | null;
  readonly createdBy: string | null;

  constructor(init: SubscriptionOneTimeUseCodeBatchInit) {
    this.id = init.id;
    this.numberOfCodes = init.numberOfCodes;
    this.environment = init.environment;
    this.isActive = init.isActive;
    this.expirationDate = init.expirationDate ?? null;
    this.createdDate = init.createdDate ?? null;
    this.createdBy = init.createdBy ?? null;

    makeAutoObservable(this, {
      id: false, numberOfCodes: false, environment: false,
      expirationDate: false, createdDate: false, createdBy: false,
    });
  }

  get environmentLabel(): string {
    return this.environment === CodeEnvironment.Production ? 'Production' : 'Sandbox';
  }

  static fromJSON(json: Record<string, unknown>): SubscriptionOneTimeUseCodeBatch {
    return new SubscriptionOneTimeUseCodeBatch({
      id: (json.id as string) ?? '',
      numberOfCodes: (json.numberOfCodes as number) ?? 0,
      environment: (json.environment as string) ?? CodeEnvironment.Production,
      isActive: (json.isActive as boolean) ?? false,
      expirationDate: (json.expirationDate as string | null | undefined) ?? null,
      createdDate: (json.createdDate as string | null | undefined) ?? null,
      createdBy: (json.createdBy as string | null | undefined) ?? null,
    });
  }
}

const SUB_ELIGIBILITY_LABELS: Record<string, string> = {
  [SubscriptionCustomerEligibility.New]: 'New',
  [SubscriptionCustomerEligibility.Existing]: 'Existing',
  [SubscriptionCustomerEligibility.Expired]: 'Expired',
};

export interface SubscriptionOfferCodeInit {
  id: string;
  /** Parent subscription — needed to scope navigation back through the
   *  repository (e.g. so `loadCustomCodes` can be invoked without
   *  threading the subscription explicitly). */
  subscriptionId?: string;
  name: string;
  offerMode: OfferMode | string;
  duration: SubscriptionDuration | string;
  numberOfPeriods: number;
  customerEligibilities: SubscriptionCustomerEligibility[];
  isActive: boolean;
  /** Whether this offer renews automatically. iOS exposes this as a
   *  per-offer-code field — defaults to `true` because most offers
   *  inherit the subscription's auto-renew behaviour. */
  autoRenewEnabled?: boolean;
  /** Stack-with-intro vs replace-intro decision. Optional — only relevant
   *  when New/Expired customers are eligible. */
  offerEligibility?: SubscriptionOfferEligibility | string | null;
  totalNumberOfCodes?: number;
  affordances?: Affordances;
}

export class SubscriptionOfferCode {
  readonly id: string;
  readonly subscriptionId: string;
  readonly name: string;
  readonly offerMode: string;
  readonly duration: string;
  readonly numberOfPeriods: number;
  readonly customerEligibilities: SubscriptionCustomerEligibility[];
  readonly autoRenewEnabled: boolean;
  readonly offerEligibility: string | null;
  isActive: boolean;
  readonly totalNumberOfCodes: number | null;
  affordances: Affordances;

  /** One-time-use code batches generated against this offer code. Empty
   *  until `loadOneTimeUseCodes()` resolves. */
  oneTimeUseCodes: SubscriptionOneTimeUseCodeBatch[] = [];
  isOneTimeUseCodesLoaded = false;

  /** Developer-defined custom codes attached to this offer code. */
  customCodes: SubscriptionCustomCode[] = [];
  isCustomCodesLoaded = false;

  repository: SubscriptionRepository | null = null;

  constructor(init: SubscriptionOfferCodeInit) {
    this.id = init.id;
    this.subscriptionId = init.subscriptionId ?? '';
    this.name = init.name;
    this.offerMode = init.offerMode;
    this.duration = init.duration;
    this.numberOfPeriods = init.numberOfPeriods;
    this.customerEligibilities = init.customerEligibilities;
    this.autoRenewEnabled = init.autoRenewEnabled ?? true;
    this.offerEligibility = init.offerEligibility ?? null;
    this.isActive = init.isActive;
    this.totalNumberOfCodes = init.totalNumberOfCodes ?? null;
    this.affordances = init.affordances ?? {};

    makeAutoObservable(this, {
      id: false, subscriptionId: false, name: false,
      offerMode: false, duration: false, numberOfPeriods: false,
      customerEligibilities: false, autoRenewEnabled: false,
      offerEligibility: false, totalNumberOfCodes: false,
      repository: false,
    });
  }

  setRepository(repo: SubscriptionRepository): void {
    this.repository = repo;
  }

  // ── Display ──

  get eligibilityLabels(): string[] {
    return this.customerEligibilities.map((e) => SUB_ELIGIBILITY_LABELS[e] ?? e);
  }

  get summaryLabel(): string { return offerSummary(this.offerMode, this.duration, this.numberOfPeriods); }

  /** Sum of every loaded one-time-use code batch's `numberOfCodes`. */
  get totalOneTimeUseCodes(): number {
    return this.oneTimeUseCodes.reduce((sum, b) => sum + b.numberOfCodes, 0);
  }

  /** Total redemption capacity of every loaded custom code. */
  get totalCustomCodes(): number {
    return this.customCodes.reduce((sum, c) => sum + c.numberOfCodes, 0);
  }

  /** App Store redemption URL template — identical to IAP's; the appId
   *  is carried on `affordances.appId` (mock + REST infra inject it). */
  get redemptionUrl(): string {
    const appId = this.affordances.appId ?? '{appId}';
    return `https://apps.apple.com/redeem?ctx=offercodes&id=${encodeURIComponent(appId)}&code=CODE`;
  }

  // ── Capability checks ──

  get canDeactivate(): boolean {
    return this.isActive && 'deactivate' in this.affordances;
  }

  // ── Mutators ──

  async loadOneTimeUseCodes(): Promise<SubscriptionOneTimeUseCodeBatch[]> {
    const repo = this.requireRepo();
    const list = await repo.oneTimeUseCodes(this);
    runInAction(() => {
      this.oneTimeUseCodes = list;
      this.isOneTimeUseCodesLoaded = true;
    });
    return list;
  }

  async loadCustomCodes(): Promise<SubscriptionCustomCode[]> {
    const repo = this.requireRepo();
    const list = await repo.customCodes(this);
    runInAction(() => {
      this.customCodes = list;
      this.isCustomCodesLoaded = true;
    });
    return list;
  }

  async createCustomCode(input: {
    customCode: string;
    numberOfCodes: number;
    expirationDate?: string | null;
  }): Promise<SubscriptionCustomCode> {
    const repo = this.requireRepo();
    const created = await repo.createCustomCode(this, input);
    runInAction(() => {
      this.customCodes = [...this.customCodes, created];
      this.isCustomCodesLoaded = true;
    });
    return created;
  }

  async generateOneTimeUseCodes(input: {
    count: number;
    environment: CodeEnvironment | string;
    expirationDate?: string | null;
  }): Promise<SubscriptionOneTimeUseCodeBatch> {
    const repo = this.requireRepo();
    const created = await repo.generateOneTimeUseCodes(this, input);
    runInAction(() => {
      this.oneTimeUseCodes = [...this.oneTimeUseCodes, created];
      this.isOneTimeUseCodesLoaded = true;
    });
    return created;
  }

  async deactivate(): Promise<void> {
    if (!this.canDeactivate) {
      throw new Error(`SubscriptionOfferCode ${this.id} cannot deactivate (already inactive or no affordance)`);
    }
    const repo = this.requireRepo();
    await repo.deactivateOfferCode(this);
    runInAction(() => { this.isActive = false; });
  }

  /** Download CSV of redeemable codes for a one-time-use batch. When
   *  `affordances.appId` is set, each line becomes
   *  `<code>,<redemption-url>`; otherwise the raw API response passes
   *  through. Mirrors `InAppPurchaseOfferCode.downloadCodes`. */
  async downloadCodes(batch: SubscriptionOneTimeUseCodeBatch): Promise<string> {
    const repo = this.requireRepo();
    const raw = await repo.oneTimeUseCodeValues(this, batch);
    const appId = this.affordances.appId;
    if (!appId) return raw;
    const codes = raw.split('\n').filter((line) => line.length > 0);
    return codes
      .map((c) => `${c},https://apps.apple.com/redeem?ctx=offercodes&id=${appId}&code=${c}`)
      .join('\n');
  }

  // ── Internal ──

  private requireRepo(): SubscriptionRepository {
    if (!this.repository) {
      throw new Error(`SubscriptionOfferCode ${this.id} has no repository attached`);
    }
    return this.repository;
  }

  // ── Factory ──

  static fromJSON(json: Record<string, unknown>): SubscriptionOfferCode {
    const eligibilitiesRaw = (json.customerEligibilities as unknown[] | undefined) ?? [];
    return new SubscriptionOfferCode({
      id: (json.id as string) ?? '',
      subscriptionId:
        (json.subscriptionId as string) ??
        (json.subscription_id as string) ??
        '',
      name: (json.name as string) ?? '',
      offerMode: ((json.offerMode as string) ?? (json.mode as string)) ?? '',
      duration: (json.duration as string) ?? '',
      numberOfPeriods: (json.numberOfPeriods as number) ?? (json.periods as number) ?? 1,
      customerEligibilities: eligibilitiesRaw.map((e) => e as SubscriptionCustomerEligibility),
      autoRenewEnabled: (json.autoRenewEnabled as boolean | undefined) ?? true,
      offerEligibility:
        (json.offerEligibility as string | undefined) ??
        (json.offer_eligibility as string | undefined) ??
        null,
      isActive: (json.isActive as boolean) ?? false,
      totalNumberOfCodes: json.totalNumberOfCodes as number | undefined,
      affordances: (json.affordances as Affordances | undefined) ?? {},
    });
  }
}
