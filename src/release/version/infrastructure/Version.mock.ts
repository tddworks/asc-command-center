import { Version, VersionState } from '../Version.ts';

export function mockVersions(appId: string): Version[] {
  return [
    new Version('v-1', appId, '2.0.0', VersionState.PrepareForSubmission, 'IOS', {
      submitForReview: '/api/v1/versions/v-1/submissions',
      updateVersion: '/api/v1/versions/v-1',
      getLocalizations: '/api/v1/versions/v-1/localizations',
    }),
    new Version('v-2', appId, '1.5.0', VersionState.ReadyForSale, 'IOS', {
      getLocalizations: '/api/v1/versions/v-2/localizations',
    }),
    new Version('v-3', appId, '1.4.0', VersionState.Rejected, 'IOS', {
      checkReviewDetail: '/api/v1/versions/v-3/review-detail',
    }),
  ];
}
