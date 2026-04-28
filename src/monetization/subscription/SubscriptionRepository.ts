import type { Subscription, SubscriptionPeriod } from './Subscription.ts';
import type { SubscriptionLocalization } from './SubscriptionLocalization.ts';
import type { SubscriptionAvailability } from './SubscriptionAvailability.ts';
import type { SubscriptionPriceSchedule } from './SubscriptionPriceSchedule.ts';
import type { SubscriptionPricePointPage } from './SubscriptionPricePoint.ts';
import type { SubscriptionReviewScreenshot } from './SubscriptionReviewScreenshot.ts';
import type {
  CodeEnvironment,
  OfferMode,
  SubscriptionCustomCode,
  SubscriptionCustomerEligibility,
  SubscriptionDuration,
  SubscriptionIntroductoryOffer,
  SubscriptionOfferCode,
  SubscriptionOfferCodePriceInput,
  SubscriptionOfferEligibility,
  SubscriptionOneTimeUseCodeBatch,
  SubscriptionPromotionalOffer,
} from './SubscriptionOffers.ts';
import type { WinBackOffer } from './WinBackOffer.ts';

export interface CreateSubscriptionOfferCodeInput {
  name: string;
  offerMode: OfferMode | string;
  duration: SubscriptionDuration | string;
  numberOfPeriods: number;
  customerEligibilities: SubscriptionCustomerEligibility[];
  /** Whether the offer renews automatically. Defaults to true at the
   *  call site (mirrors iOS's wizard default). */
  autoRenewEnabled?: boolean;
  /** Stack-with-intro vs replace-intro. Only relevant when New/Expired
   *  customers are eligible — wizard wires this only then. */
  offerEligibility?: SubscriptionOfferEligibility | string | null;
  /** Per-territory pricing for the offer code. Free offers send
   *  `pricePointId: null` for every territory; paid offers send the
   *  picked id for the anchor territory and `null` elsewhere. */
  prices?: SubscriptionOfferCodePriceInput[];
}

export interface CreateSubscriptionCustomCodeInput {
  customCode: string;
  numberOfCodes: number;
  expirationDate?: string | null;
}

export interface GenerateSubscriptionOneTimeUseCodesInput {
  count: number;
  environment: CodeEnvironment | string;
  expirationDate?: string | null;
}

export interface CreateIntroductoryOfferInput {
  offerMode: OfferMode | string;
  duration: SubscriptionDuration | string;
  numberOfPeriods: number;
  territory?: string | null;
  startDate?: string | null;
  endDate?: string | null;
}

export interface CreatePromotionalOfferInput {
  name: string;
  offerCode: string;
  offerMode: OfferMode | string;
  duration: SubscriptionDuration | string;
  numberOfPeriods: number;
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
  pricePoints(
    sub: Subscription,
    input: { territoryId: string; cursor: string | null; limit?: number },
  ): Promise<SubscriptionPricePointPage>;
  equalizations(
    sub: Subscription,
    input: { pricePointId: string; cursor: string | null; limit?: number },
  ): Promise<SubscriptionPricePointPage>;

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
  createIntroductoryOffer(sub: Subscription, input: CreateIntroductoryOfferInput): Promise<SubscriptionIntroductoryOffer>;
  deleteIntroductoryOffer(offer: SubscriptionIntroductoryOffer): Promise<void>;

  promotionalOffers(sub: Subscription): Promise<SubscriptionPromotionalOffer[]>;
  createPromotionalOffer(sub: Subscription, input: CreatePromotionalOfferInput): Promise<SubscriptionPromotionalOffer>;
  deletePromotionalOffer(offer: SubscriptionPromotionalOffer): Promise<void>;

  offerCodes(sub: Subscription): Promise<SubscriptionOfferCode[]>;
  createOfferCode(sub: Subscription, input: CreateSubscriptionOfferCodeInput): Promise<SubscriptionOfferCode>;
  deactivateOfferCode(code: SubscriptionOfferCode): Promise<void>;

  // ── Offer-code children ──
  oneTimeUseCodes(code: SubscriptionOfferCode): Promise<SubscriptionOneTimeUseCodeBatch[]>;
  generateOneTimeUseCodes(
    code: SubscriptionOfferCode,
    input: GenerateSubscriptionOneTimeUseCodesInput,
  ): Promise<SubscriptionOneTimeUseCodeBatch>;
  customCodes(code: SubscriptionOfferCode): Promise<SubscriptionCustomCode[]>;
  createCustomCode(
    code: SubscriptionOfferCode,
    input: CreateSubscriptionCustomCodeInput,
  ): Promise<SubscriptionCustomCode>;
  /** Raw CSV of redeemable codes for a one-time-use batch. The domain
   *  enriches each line with a redemption URL when an appId affordance
   *  is present. */
  oneTimeUseCodeValues(
    code: SubscriptionOfferCode,
    batch: SubscriptionOneTimeUseCodeBatch,
  ): Promise<string>;

  // ── Win-back offers ──
  winBackOffers(sub: Subscription): Promise<WinBackOffer[]>;
}
