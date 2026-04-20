import type { Build } from '../build/Build.ts';
import type { Certificate } from '../code-signing/Certificate.ts';

/**
 * Fleet-wide briefing — "what needs my attention?"
 *
 * A read-only aggregate stitched together from the four fleet-wide ASC API
 * endpoints we can actually hit (reviewSubmissions × 2, certificates, builds).
 * The domain class carries the semantic booleans so components never recompute
 * urgency from raw counts.
 */
export class Dashboard {
  constructor(
    readonly submissionsAwaitingReview: number,
    readonly submissionsWithIssues: number,
    readonly expiringCertificates: Certificate[],
    readonly recentBuilds: Build[],
  ) {}

  // ── Semantic booleans ──

  get allClear(): boolean {
    return (
      this.submissionsAwaitingReview === 0 &&
      this.submissionsWithIssues === 0 &&
      this.expiringCertificates.length === 0
    );
  }

  get hasWork(): boolean {
    return !this.allClear;
  }

  /** Anything red — rejections or certs <7d from expiry. */
  get isUrgent(): boolean {
    return (
      this.submissionsWithIssues > 0 ||
      this.expiringCertificates.some((c) => c.isExpiringCritical())
    );
  }

  // ── Groupings useful for rendering ──

  get criticalCertificates(): Certificate[] {
    return this.expiringCertificates.filter((c) => c.isExpiringCritical());
  }

  get warningCertificates(): Certificate[] {
    return this.expiringCertificates.filter((c) => !c.isExpiringCritical());
  }
}
