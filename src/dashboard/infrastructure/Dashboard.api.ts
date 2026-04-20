import { Dashboard } from '../Dashboard.ts';
import { Build } from '../../build/Build.ts';
import { Certificate } from '../../code-signing/Certificate.ts';
import { apiClient, type DataMode } from '../../shared/api-client.tsx';
import type { DashboardRepository } from '../DashboardRepository.ts';

type ListResponse = {
  data: Record<string, unknown>[];
  meta?: { paging?: { total?: number } };
};

/**
 * The four queries we can make fleet-wide against the real ASC surface:
 *
 *   1. GET /reviewSubmissions?filter[state]=WAITING_FOR_REVIEW,IN_REVIEW,READY_FOR_REVIEW
 *   2. GET /reviewSubmissions?filter[state]=UNRESOLVED_ISSUES
 *   3. GET /certificates                     (client-side filter by expirationDate)
 *   4. GET /builds?sort=-uploadedDate        (top 5 recent)
 *
 * Everything else the dashboard could conceivably want — unanswered customer
 * reviews, per-app release state counts — is NOT fleet-scoped in the ASC API
 * and would need either N-per-app fan-out or a backend aggregator. Out of
 * scope for v1.
 */
export class RestDashboardRepository implements DashboardRepository {
  async load(): Promise<Dashboard> {
    const [awaiting, issues, certs, builds] = await Promise.all([
      apiClient.get<ListResponse>(
        '/api/v1/reviewSubmissions?filter[state]=WAITING_FOR_REVIEW,IN_REVIEW,READY_FOR_REVIEW&limit=200',
      ),
      apiClient.get<ListResponse>(
        '/api/v1/reviewSubmissions?filter[state]=UNRESOLVED_ISSUES&limit=200',
      ),
      apiClient.get<ListResponse>('/api/v1/certificates?limit=200'),
      apiClient.get<ListResponse>('/api/v1/builds?sort=-uploadedDate&limit=5'),
    ]);

    const expiringCertificates = certs.data
      .map((row) => Certificate.fromJSON(row))
      .filter((c) => c.isExpiringSoon());

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
