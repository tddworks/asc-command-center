import { Dashboard } from '../Dashboard.ts';
import { Build } from '../../release/build/Build.ts';
import { Certificate } from '../../developer-tools/code-signing/Certificate.ts';
import { apiClient, type DataMode } from '../../shared/api-client.tsx';
import type { DashboardRepository } from '../DashboardRepository.ts';

type ListResponse = {
  data: Record<string, unknown>[];
  meta?: { paging?: { total?: number } };
};

const EXPIRY_WINDOW_DAYS = 14;
const RECENT_BUILDS_LIMIT = 5;
const AWAITING_STATES = 'WAITING_FOR_REVIEW,IN_REVIEW,READY_FOR_REVIEW';
const ISSUE_STATES = 'UNRESOLVED_ISSUES';

function isoDaysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function countOf(resp: ListResponse): number {
  return resp.meta?.paging?.total ?? resp.data.length;
}

const EMPTY: ListResponse = { data: [] };

/**
 * Four calls, regardless of fleet size:
 *
 *   1. GET /api/v1/builds?sort=-uploadedDate&limit=5               (fleet)
 *   2. GET /api/v1/certificates?before=<now+14d>&limit=200         (fleet, server-side expiry filter)
 *   3. GET /api/v1/apps/{currentAppId}/review-submissions?state=A  (per pinned app)
 *   4. GET /api/v1/apps/{currentAppId}/review-submissions?state=I  (per pinned app)
 *
 * Review-submissions are scoped to the pinned app because Apple requires
 * `filter[app]` on `/v1/reviewSubmissions` — fleet listing is impossible at
 * the platform level, not just our backend's. When no app is pinned, tiles
 * 3 and 4 are skipped and show zero with a helper hint.
 *
 * Every call has a graceful fallback; one 404/500 won't nuke the dashboard.
 */
export class RestDashboardRepository implements DashboardRepository {
  async load(currentAppId: string | null): Promise<Dashboard> {
    const expiryCutoff = encodeURIComponent(isoDaysFromNow(EXPIRY_WINDOW_DAYS));

    const safeGet = (path: string): Promise<ListResponse> =>
      apiClient.get<ListResponse>(path).catch(() => EMPTY);

    const [buildsResp, certsResp, awaitingResp, issuesResp] = await Promise.all([
      safeGet(`/api/v1/builds?sort=-uploadedDate&limit=${RECENT_BUILDS_LIMIT}`),
      safeGet(`/api/v1/certificates?before=${expiryCutoff}&limit=200`),
      currentAppId
        ? safeGet(`/api/v1/apps/${currentAppId}/review-submissions?state=${AWAITING_STATES}&limit=200`)
        : Promise.resolve(EMPTY),
      currentAppId
        ? safeGet(`/api/v1/apps/${currentAppId}/review-submissions?state=${ISSUE_STATES}&limit=200`)
        : Promise.resolve(EMPTY),
    ]);

    // Belt-and-suspenders: server-side ?before= narrows the payload, client
    // filter enforces the isValid gate (no expired/revoked certs show up).
    const expiringCertificates = certsResp.data
      .map((row) => Certificate.fromJSON(row))
      .filter((c) => c.isExpiringSoon(EXPIRY_WINDOW_DAYS));

    const recentBuilds = buildsResp.data.map(Build.fromJSON);

    return new Dashboard(
      countOf(awaitingResp),
      countOf(issuesResp),
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
