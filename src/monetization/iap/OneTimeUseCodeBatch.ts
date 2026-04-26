import { makeAutoObservable } from 'mobx';

export const CodeEnvironment = {
  Production: 'PRODUCTION',
  Sandbox: 'SANDBOX',
} as const;
export type CodeEnvironment = typeof CodeEnvironment[keyof typeof CodeEnvironment];

export interface IAPOneTimeUseCodeBatchInit {
  id: string;
  numberOfCodes: number;
  environment: CodeEnvironment | string;
  isActive: boolean;
  expirationDate?: string | null;
  createdDate?: string | null;
  createdBy?: string | null;
}

/**
 * One generated batch of one-time-use offer codes for an IAP. Apple
 * lets you generate multiple batches per offer code (production + sandbox)
 * — each batch is immutable once created. The page lists batches and
 * shows download CTAs; the create flow ships when the file-export side
 * lands.
 */
export class IAPOneTimeUseCodeBatch {
  readonly id: string;
  readonly numberOfCodes: number;
  readonly environment: string;
  isActive: boolean;
  readonly expirationDate: string | null;
  readonly createdDate: string | null;
  readonly createdBy: string | null;

  constructor(init: IAPOneTimeUseCodeBatchInit) {
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

  static fromJSON(json: Record<string, unknown>): IAPOneTimeUseCodeBatch {
    return new IAPOneTimeUseCodeBatch({
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
