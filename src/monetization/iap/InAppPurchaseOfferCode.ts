import { makeAutoObservable, runInAction } from 'mobx';
import type { Affordances } from '../../shared/types.ts';
import type { InAppPurchaseRepository } from './InAppPurchaseRepository.ts';
import type { CodeEnvironment, IAPOneTimeUseCodeBatch } from './OneTimeUseCodeBatch.ts';
import type { IAPCustomCode } from './IAPCustomCode.ts';

/** Customer eligibility flags for IAP offer codes — Apple's three buckets:
 *  users who have never bought (`NonSpender` = "new"), users actively
 *  spending (`ActiveSpender` = "existing"), and lapsed buyers
 *  (`ChurnedSpender` = "churned"). The string values mirror Apple's API
 *  but the enum keys avoid the marketing language. */
export const IAPCustomerEligibility = {
  NonSpender: 'NEW',
  ActiveSpender: 'EXISTING',
  ChurnedSpender: 'CHURNED',
} as const;
export type IAPCustomerEligibility = typeof IAPCustomerEligibility[keyof typeof IAPCustomerEligibility];

const ELIGIBILITY_LABELS: Record<string, string> = {
  [IAPCustomerEligibility.NonSpender]: 'New',
  [IAPCustomerEligibility.ActiveSpender]: 'Existing',
  [IAPCustomerEligibility.ChurnedSpender]: 'Churned',
};

export interface InAppPurchaseOfferCodeInit {
  id: string;
  iapId: string;
  name: string;
  customerEligibilities: IAPCustomerEligibility[];
  isActive: boolean;
  productionCodeCount?: number;
  sandboxCodeCount?: number;
  affordances?: Affordances;
}

/**
 * One offer code on an IAP. Supports the read-side of the iOS prototype's
 * Offers tab — list with eligibility badges + active state + code counts —
 * plus the deactivate action. Create flow + one-time-use / custom code
 * batch management ship in a later phase.
 */
export class InAppPurchaseOfferCode {
  readonly id: string;
  readonly iapId: string;
  readonly name: string;
  readonly customerEligibilities: IAPCustomerEligibility[];
  isActive: boolean;
  readonly productionCodeCount: number | null;
  readonly sandboxCodeCount: number | null;
  affordances: Affordances;

  /** Generated one-time-use code batches loaded from
   *  `loadOneTimeUseCodes`. Empty until loaded. */
  oneTimeUseCodes: IAPOneTimeUseCodeBatch[] = [];
  isOneTimeUseCodesLoaded = false;

  /** Developer-defined custom codes attached to this offer code. Empty
   *  until `loadCustomCodes` has resolved. */
  customCodes: IAPCustomCode[] = [];
  isCustomCodesLoaded = false;

  repository: InAppPurchaseRepository | null = null;

  constructor(init: InAppPurchaseOfferCodeInit) {
    this.id = init.id;
    this.iapId = init.iapId;
    this.name = init.name;
    this.customerEligibilities = init.customerEligibilities;
    this.isActive = init.isActive;
    this.productionCodeCount = init.productionCodeCount ?? null;
    this.sandboxCodeCount = init.sandboxCodeCount ?? null;
    this.affordances = init.affordances ?? {};

    makeAutoObservable(this, {
      id: false, iapId: false, name: false,
      customerEligibilities: false,
      productionCodeCount: false, sandboxCodeCount: false,
      repository: false,
    });
  }

  setRepository(repo: InAppPurchaseRepository): void {
    this.repository = repo;
  }

  // ── Display ──

  get eligibilityLabels(): string[] {
    return this.customerEligibilities.map((e) => ELIGIBILITY_LABELS[e] ?? e);
  }

  get totalCodes(): number {
    return (this.productionCodeCount ?? 0) + (this.sandboxCodeCount ?? 0);
  }

  /** Sum of every loaded one-time-use code batch's `numberOfCodes`. The
   *  list-card stat shows this once batches have been loaded. */
  get totalOneTimeUseCodes(): number {
    return this.oneTimeUseCodes.reduce((sum, b) => sum + b.numberOfCodes, 0);
  }

  /** Total redemption capacity of every loaded custom code. */
  get totalCustomCodes(): number {
    return this.customCodes.reduce((sum, c) => sum + c.numberOfCodes, 0);
  }

  /** App Store's redemption URL template. The page can show this with
   *  `{appId}` substituted with the App Store id (carried on
   *  `affordances.appId`) so users can copy it for marketing. */
  get redemptionUrl(): string {
    const appStoreId = this.affordances.appId ?? '{appId}';
    const idParam = encodeURIComponent(appStoreId);
    return `https://apps.apple.com/redeem?ctx=offercodes&id=${idParam}&code=CODE`;
  }

  // ── Capability checks ──

  get canDeactivate(): boolean {
    return this.isActive && 'deactivate' in this.affordances;
  }

  // ── Mutators ──

  async loadOneTimeUseCodes(): Promise<IAPOneTimeUseCodeBatch[]> {
    if (!this.repository) {
      throw new Error(`OfferCode ${this.id} has no repository attached`);
    }
    const list = await this.repository.oneTimeUseCodes(this);
    runInAction(() => {
      this.oneTimeUseCodes = list;
      this.isOneTimeUseCodesLoaded = true;
    });
    return list;
  }

  async loadCustomCodes(): Promise<IAPCustomCode[]> {
    if (!this.repository) {
      throw new Error(`OfferCode ${this.id} has no repository attached`);
    }
    const list = await this.repository.customCodes(this);
    runInAction(() => {
      this.customCodes = list;
      this.isCustomCodesLoaded = true;
    });
    return list;
  }

  async createCustomCode(input: { customCode: string; numberOfCodes: number; expirationDate?: string | null }): Promise<IAPCustomCode> {
    if (!this.repository) {
      throw new Error(`OfferCode ${this.id} has no repository attached`);
    }
    const created = await this.repository.createCustomCode(this, input);
    runInAction(() => {
      this.customCodes = [...this.customCodes, created];
      this.isCustomCodesLoaded = true;
    });
    return created;
  }

  async generateOneTimeUseCodes(input: { count: number; environment: CodeEnvironment | string }): Promise<IAPOneTimeUseCodeBatch> {
    if (!this.repository) {
      throw new Error(`OfferCode ${this.id} has no repository attached`);
    }
    const batch = await this.repository.generateOneTimeUseCodes(this, input);
    runInAction(() => {
      this.oneTimeUseCodes = [...this.oneTimeUseCodes, batch];
      this.isOneTimeUseCodesLoaded = true;
    });
    return batch;
  }

  /** Download the redeemable values for a one-time-use batch as a CSV.
   *  When an appId affordance is present, each line becomes
   *  `<code>,<redemption-url>` matching Apple's web download format;
   *  otherwise the raw codes from the API pass through untouched.
   *  Mirrors `InAppPurchaseOfferCode.downloadCodes(for:)` in the SDK. */
  async downloadCodes(batch: IAPOneTimeUseCodeBatch): Promise<string> {
    if (!this.repository) {
      throw new Error(`OfferCode ${this.id} has no repository attached`);
    }
    const raw = await this.repository.oneTimeUseCodeValues(this, batch);
    const appId = this.affordances.appId;
    if (!appId) return raw;
    const codes = raw.split('\n').filter((line) => line.length > 0);
    return codes
      .map((c) => `${c},https://apps.apple.com/redeem?ctx=offercodes&id=${appId}&code=${c}`)
      .join('\n');
  }

  async deactivate(): Promise<void> {
    if (!this.canDeactivate) {
      throw new Error(`OfferCode ${this.id} cannot deactivate (already inactive or no affordance)`);
    }
    if (!this.repository) {
      throw new Error(`OfferCode ${this.id} has no repository attached`);
    }
    await this.repository.deactivateOfferCode(this);
    runInAction(() => { this.isActive = false; });
  }

  // ── Factory ──

  static fromJSON(json: Record<string, unknown>): InAppPurchaseOfferCode {
    const eligibilitiesRaw = (json.customerEligibilities as unknown[] | undefined) ?? [];
    return new InAppPurchaseOfferCode({
      id: (json.id as string) ?? '',
      iapId: ((json.iapId as string) ?? (json.inAppPurchaseId as string)) ?? '',
      name: (json.name as string) ?? '',
      customerEligibilities: eligibilitiesRaw.map((e) => e as IAPCustomerEligibility),
      isActive: (json.isActive as boolean) ?? false,
      productionCodeCount: json.productionCodeCount as number | undefined,
      sandboxCodeCount: json.sandboxCodeCount as number | undefined,
      affordances: (json.affordances as Affordances | undefined) ?? {},
    });
  }
}
