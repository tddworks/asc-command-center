import type { OfferMode, SubscriptionDuration } from './SubscriptionOffers.ts';

export const WinBackPriority = {
  High: 'HIGH',
  Normal: 'NORMAL',
} as const;
export type WinBackPriority = typeof WinBackPriority[keyof typeof WinBackPriority];

export interface WinBackOfferInit {
  id: string;
  referenceName: string;
  offerMode: OfferMode | string;
  duration: SubscriptionDuration | string;
  numberOfPeriods: number;
  priority: WinBackPriority | string;
}

const OFFER_MODE_LABELS: Record<string, string> = {
  FREE_TRIAL: 'Free Trial',
  PAY_AS_YOU_GO: 'Pay as You Go',
  PAY_UP_FRONT: 'Pay Up Front',
};
const DURATION_LABELS: Record<string, string> = {
  ONE_WEEK: '1 Week',
  ONE_MONTH: '1 Month',
  TWO_MONTHS: '2 Months',
  THREE_MONTHS: '3 Months',
  SIX_MONTHS: '6 Months',
  ONE_YEAR: '1 Year',
};

/**
 * Win-back offer for lapsed subscribers. Apple gates these on subscription
 * approval — the page only loads them when `Subscription.isApproved`.
 * The create wizard is not implemented in the iOS prototype either, so
 * this slice is read-only today.
 */
export class WinBackOffer {
  readonly id: string;
  readonly referenceName: string;
  readonly offerMode: string;
  readonly duration: string;
  readonly numberOfPeriods: number;
  readonly priority: string;

  constructor(init: WinBackOfferInit) {
    this.id = init.id;
    this.referenceName = init.referenceName;
    this.offerMode = init.offerMode;
    this.duration = init.duration;
    this.numberOfPeriods = init.numberOfPeriods;
    this.priority = init.priority;
  }

  get summaryLabel(): string {
    const modeLabel = OFFER_MODE_LABELS[this.offerMode] ?? this.offerMode;
    const durationLabel = DURATION_LABELS[this.duration] ?? this.duration;
    return this.numberOfPeriods === 1
      ? `${modeLabel} · ${durationLabel}`
      : `${modeLabel} · ${this.numberOfPeriods} × ${durationLabel}`;
  }

  get priorityLabel(): string {
    return this.priority === WinBackPriority.High ? 'High' : 'Normal';
  }

  static fromJSON(json: Record<string, unknown>): WinBackOffer {
    return new WinBackOffer({
      id: (json.id as string) ?? '',
      referenceName: ((json.referenceName as string) ?? (json.name as string)) ?? '',
      offerMode: ((json.offerMode as string) ?? (json.mode as string)) ?? '',
      duration: (json.duration as string) ?? '',
      numberOfPeriods:
        (json.numberOfPeriods as number) ??
        (json.periods as number) ??
        1,
      priority: ((json.priority as string) ?? WinBackPriority.Normal),
    });
  }
}
