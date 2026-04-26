import { makeAutoObservable } from 'mobx';

export interface IAPCustomCodeInit {
  id: string;
  /** The developer-defined custom string used as the redemption code. */
  customCode: string;
  /** Maximum number of redemptions allowed for this code. */
  numberOfCodes: number;
  /** Optional ISO date when this code stops accepting redemptions. */
  expirationDate?: string | null;
  isActive: boolean;
}

/**
 * One developer-defined custom redemption code attached to an IAP offer
 * code (e.g. "BLACKFRIDAY2026"). Different from one-time-use code batches:
 * a custom code is a single string that can be redeemed up to
 * `numberOfCodes` times.
 */
export class IAPCustomCode {
  readonly id: string;
  readonly customCode: string;
  readonly numberOfCodes: number;
  readonly expirationDate: string | null;
  isActive: boolean;

  constructor(init: IAPCustomCodeInit) {
    this.id = init.id;
    this.customCode = init.customCode;
    this.numberOfCodes = init.numberOfCodes;
    this.expirationDate = init.expirationDate ?? null;
    this.isActive = init.isActive;

    makeAutoObservable(this, {
      id: false, customCode: false, numberOfCodes: false, expirationDate: false,
    });
  }

  static fromJSON(json: Record<string, unknown>): IAPCustomCode {
    return new IAPCustomCode({
      id: (json.id as string) ?? '',
      customCode: (json.customCode as string) ?? '',
      numberOfCodes: (json.numberOfCodes as number) ?? 0,
      expirationDate: (json.expirationDate as string | null | undefined) ?? null,
      isActive: (json.isActive as boolean) ?? false,
    });
  }
}
