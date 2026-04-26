import { makeAutoObservable } from 'mobx';
import type { Affordances } from '../../shared/types.ts';

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

const SUB_ELIGIBILITY_LABELS: Record<string, string> = {
  [SubscriptionCustomerEligibility.New]: 'New',
  [SubscriptionCustomerEligibility.Existing]: 'Existing',
  [SubscriptionCustomerEligibility.Expired]: 'Expired',
};

export interface SubscriptionOfferCodeInit {
  id: string;
  name: string;
  offerMode: OfferMode | string;
  duration: SubscriptionDuration | string;
  numberOfPeriods: number;
  customerEligibilities: SubscriptionCustomerEligibility[];
  isActive: boolean;
  totalNumberOfCodes?: number;
  affordances?: Affordances;
}

export class SubscriptionOfferCode {
  readonly id: string;
  readonly name: string;
  readonly offerMode: string;
  readonly duration: string;
  readonly numberOfPeriods: number;
  readonly customerEligibilities: SubscriptionCustomerEligibility[];
  isActive: boolean;
  readonly totalNumberOfCodes: number | null;
  affordances: Affordances;

  constructor(init: SubscriptionOfferCodeInit) {
    this.id = init.id;
    this.name = init.name;
    this.offerMode = init.offerMode;
    this.duration = init.duration;
    this.numberOfPeriods = init.numberOfPeriods;
    this.customerEligibilities = init.customerEligibilities;
    this.isActive = init.isActive;
    this.totalNumberOfCodes = init.totalNumberOfCodes ?? null;
    this.affordances = init.affordances ?? {};

    makeAutoObservable(this);
  }

  get eligibilityLabels(): string[] {
    return this.customerEligibilities.map((e) => SUB_ELIGIBILITY_LABELS[e] ?? e);
  }

  get summaryLabel(): string { return offerSummary(this.offerMode, this.duration, this.numberOfPeriods); }

  static fromJSON(json: Record<string, unknown>): SubscriptionOfferCode {
    const eligibilitiesRaw = (json.customerEligibilities as unknown[] | undefined) ?? [];
    return new SubscriptionOfferCode({
      id: (json.id as string) ?? '',
      name: (json.name as string) ?? '',
      offerMode: ((json.offerMode as string) ?? (json.mode as string)) ?? '',
      duration: (json.duration as string) ?? '',
      numberOfPeriods: (json.numberOfPeriods as number) ?? (json.periods as number) ?? 1,
      customerEligibilities: eligibilitiesRaw.map((e) => e as SubscriptionCustomerEligibility),
      isActive: (json.isActive as boolean) ?? false,
      totalNumberOfCodes: json.totalNumberOfCodes as number | undefined,
      affordances: (json.affordances as Affordances | undefined) ?? {},
    });
  }
}
