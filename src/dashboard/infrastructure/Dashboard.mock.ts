import { Dashboard } from '../Dashboard.ts';
import { Build, BuildProcessingState } from '../../build/Build.ts';
import { Certificate } from '../../code-signing/Certificate.ts';
import type { DashboardRepository } from '../DashboardRepository.ts';

function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export class MockDashboardRepository implements DashboardRepository {
  async load(_currentAppId: string | null): Promise<Dashboard> {
    const expiringCertificates = [
      new Certificate(
        'cert-1',
        'iOS Distribution · TDDWorks',
        'IOS_DISTRIBUTION',
        'AB12CD34',
        daysFromNow(5),
        'VALID',
        {},
      ),
      new Certificate(
        'cert-2',
        'Apple Distribution · FitnessTracker',
        'DISTRIBUTION',
        'FF99AA11',
        daysFromNow(12),
        'VALID',
        {},
      ),
    ];

    const recentBuilds = [
      new Build('b-1', 'app-1', '142', '2.2.0', BuildProcessingState.Valid,  false, false, daysFromNow(-0), {
        addToTestFlight: 'asc testflight add --build-id b-1',
      }),
      new Build('b-2', 'app-1', '141', '2.2.0', BuildProcessingState.Valid,  false, false, daysFromNow(-1), {}),
      new Build('b-3', 'app-2', '89',  '1.6.3', BuildProcessingState.Processing, false, false, daysFromNow(-2), {}),
      new Build('b-4', 'app-1', '140', '2.1.9', BuildProcessingState.Valid,  true,  false, daysFromNow(-95), {}),
      new Build('b-5', 'app-2', '88',  '1.6.2', BuildProcessingState.Valid,  false, false, daysFromNow(-4), {}),
    ];

    return new Dashboard(
      /* awaitingReview */ 3,
      /* withIssues   */   1,
      expiringCertificates,
      recentBuilds,
    );
  }
}
