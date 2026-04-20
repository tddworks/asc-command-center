import { Dashboard } from '../Dashboard.ts';
import { Build } from '../../build/Build.ts';
import { Certificate } from '../../code-signing/Certificate.ts';
import { apiClient, type DataMode } from '../../shared/api-client.tsx';
import type { DashboardRepository } from '../DashboardRepository.ts';

type ListResponse = {
  data: Record<string, unknown>[];
  meta?: { paging?: { total?: number } };
};

const EXPIRY_WINDOW_DAYS = 14;

function isoDaysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

/**
 * Four fleet-wide queries, all backed by corresponding `asc` CLI commands:
 *
 *   1. asc review-submissions list --state WAITING_FOR_REVIEW,IN_REVIEW,READY_FOR_REVIEW
 *   2. asc review-submissions list --state UNRESOLVED_ISSUES
 *   3. asc certificates list --before <now+14d>     (server-side expiry filter)
 *   4. asc builds list --sort -uploadedDate --limit 5
 *
 * Everything runs in parallel. Counts come from the response's paging meta
 * when provided, otherwise the returned array length (capped at limit=200).
 */
export class RestDashboardRepository implements DashboardRepository {
  async load(): Promise<Dashboard> {
    const expiryCutoff = encodeURIComponent(isoDaysFromNow(EXPIRY_WINDOW_DAYS));

    const [awaiting, issues, certs, builds] = await Promise.all([
      apiClient.get<ListResponse>(
        '/api/v1/reviewSubmissions?filter[state]=WAITING_FOR_REVIEW,IN_REVIEW,READY_FOR_REVIEW&limit=200',
      ),
      apiClient.get<ListResponse>(
        '/api/v1/reviewSubmissions?filter[state]=UNRESOLVED_ISSUES&limit=200',
      ),
      apiClient.get<ListResponse>(`/api/v1/certificates?before=${expiryCutoff}&limit=200`),
      apiClient.get<ListResponse>('/api/v1/builds?sort=-uploadedDate&limit=5'),
    ]);

    // Belt-and-suspenders: the server-side `before` filter narrows the payload,
    // but we still run isExpiringSoon() to enforce the isValid gate (no expired
    // or revoked certs on the dashboard).
    const expiringCertificates = certs.data
      .map((row) => Certificate.fromJSON(row))
      .filter((c) => c.isExpiringSoon(EXPIRY_WINDOW_DAYS));

    const recentBuilds = builds.data.map(Build.fromJSON);

    return new Dashboard(
      awaiting.meta?.paging?.total ?? awaiting.data.length,
      issues.meta?.paging?.total ?? issues.data.length,
      expiringCertificates,
      recentBuilds,
    );
  }
}

/** Resolve the DashboardRepository implementation for the current data mode. */
export async function repositoryFor(mode: DataMode): Promise<DashboardRepository> {
  if (mode === 'mock') {
    const { MockDashboardRepository } = await import('./Dashboard.mock.ts');
    return new MockDashboardRepository();
  }
  return new RestDashboardRepository();
}
