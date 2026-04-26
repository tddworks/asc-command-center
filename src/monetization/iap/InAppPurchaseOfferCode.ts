import { makeAutoObservable, runInAction } from 'mobx';
import type { Affordances } from '../../shared/types.ts';
import type { InAppPurchaseRepository } from './InAppPurchaseRepository.ts';

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

  // ── Capability checks ──

  get canDeactivate(): boolean {
    return this.isActive && 'deactivate' in this.affordances;
  }

  // ── Mutators ──

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
