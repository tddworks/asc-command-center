import type { Affordances } from '../../shared/types.ts';

export type CertificateStatus = 'VALID' | 'EXPIRED' | 'REVOKED';

export class Certificate {
  constructor(
    readonly id: string,
    readonly name: string,
    readonly certificateType: string,
    readonly serialNumber: string,
    readonly expirationDate: string,
    readonly status: CertificateStatus,
    readonly affordances: Affordances,
  ) {}

  // ── Semantic Booleans ──

  get isValid(): boolean {
    return this.status === 'VALID';
  }

  get isExpired(): boolean {
    return this.status === 'EXPIRED';
  }

  // ── Expiration math ──

  /** Days between now and expirationDate. Negative when expired. */
  daysUntilExpiration(now: Date = new Date()): number {
    const exp = new Date(this.expirationDate).getTime();
    const diff = exp - now.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }

  /** True when expiry is within `withinDays` (default 14) and the cert is still valid. */
  isExpiringSoon(withinDays: number = 14, now: Date = new Date()): boolean {
    if (!this.isValid) return false;
    const days = this.daysUntilExpiration(now);
    return days >= 0 && days <= withinDays;
  }

  /** True when expiry is within 7 days — warrants a red tile, not amber. */
  isExpiringCritical(now: Date = new Date()): boolean {
    return this.isExpiringSoon(7, now);
  }

  // ── Capability Checks ──

  get canRevoke(): boolean {
    return 'revoke' in this.affordances;
  }

  // ── Display ──

  get displayName(): string {
    return `${this.name} (${this.certificateType})`;
  }

  // ── Factory ──

  static fromJSON(json: Record<string, unknown>): Certificate {
    return new Certificate(
      json.id as string,
      json.name as string,
      json.certificateType as string,
      json.serialNumber as string,
      json.expirationDate as string,
      json.status as CertificateStatus,
      (json.affordances as Affordances) ?? {},
    );
  }
}
