import type { Subscription, SubscriptionPeriod } from './Subscription.ts';
import type { SubscriptionLocalization } from './SubscriptionLocalization.ts';
import type { SubscriptionAvailability } from './SubscriptionAvailability.ts';
import type { SubscriptionPriceSchedule } from './SubscriptionPriceSchedule.ts';
import type { SubscriptionReviewScreenshot } from './SubscriptionReviewScreenshot.ts';
import type {
  OfferMode,
  SubscriptionCustomerEligibility,
  SubscriptionDuration,
  SubscriptionIntroductoryOffer,
  SubscriptionOfferCode,
  SubscriptionPromotionalOffer,
} from './SubscriptionOffers.ts';

export interface CreateSubscriptionOfferCodeInput {
  name: string;
  offerMode: OfferMode | string;
  duration: SubscriptionDuration | string;
  numberOfPeriods: number;
  customerEligibilities: SubscriptionCustomerEligibility[];
}

export interface CreateSubscriptionInput {
  groupId: string;
  name: string;
  productId: string;
  subscriptionPeriod: SubscriptionPeriod | string;
  isFamilySharable: boolean;
}

export interface CreateSubscriptionLocalizationInput {
  locale: string;
  name: string;
  description?: string | null;
}

/** Port for individual subscription tier mutations. The group-level
 *  CRUD lives on `SubscriptionGroupRepository`. Tier `get` is intentionally
 *  not on this port — single-tier reload would collide with the group's
 *  `get(id)` when one REST handle implements both interfaces. */
export interface SubscriptionRepository {
  update(
    sub: Subscription,
    patch: {
      name?: string;
      subscriptionPeriod?: SubscriptionPeriod | string;
      isFamilySharable?: boolean;
      groupLevel?: number | null;
      reviewNote?: string | null;
    },
  ): Promise<void>;
  remove(sub: Subscription): Promise<void>;
  submit(sub: Subscription): Promise<void>;
  unsubmit(sub: Subscription): Promise<void>;

  // ── Localizations ──
  localizations(sub: Subscription): Promise<SubscriptionLocalization[]>;
  createLocalization(sub: Subscription, input: CreateSubscriptionLocalizationInput): Promise<SubscriptionLocalization>;
  saveLocalization(loc: SubscriptionLocalization): Promise<void>;
  deleteLocalization(loc: SubscriptionLocalization): Promise<void>;

  // ── Pricing ──
  /** Returns null when the subscription has no price schedule yet. */
  priceSchedule(sub: Subscription): Promise<SubscriptionPriceSchedule | null>;
  setPrices(
    sub: Subscription,
    input: Array<{ territoryId: string; pricePointId: string }>,
  ): Promise<void>;

  // ── Review screenshot ──
  reviewScreenshot(sub: Subscription): Promise<SubscriptionReviewScreenshot | null>;
  uploadReviewScreenshot(sub: Subscription, file: File): Promise<SubscriptionReviewScreenshot>;
  deleteReviewScreenshot(sub: Subscription, screenshot: SubscriptionReviewScreenshot): Promise<void>;

  // ── Availability ──
  availability(sub: Subscription): Promise<SubscriptionAvailability | null>;
  setAvailability(
    sub: Subscription,
    input: { territoryIds: string[]; availableInNewTerritories: boolean },
  ): Promise<void>;

  // ── Offers ──
  introductoryOffers(sub: Subscription): Promise<SubscriptionIntroductoryOffer[]>;
  promotionalOffers(sub: Subscription): Promise<SubscriptionPromotionalOffer[]>;
  offerCodes(sub: Subscription): Promise<SubscriptionOfferCode[]>;
  createOfferCode(sub: Subscription, input: CreateSubscriptionOfferCodeInput): Promise<SubscriptionOfferCode>;
}
