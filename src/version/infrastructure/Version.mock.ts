import { Version, VersionState } from '../Version.ts';

export function mockVersions(appId: string): Version[] {
  return [
    new Version('v-1', appId, '2.0.0', VersionState.PrepareForSubmission, 'IOS', {
      submitForReview: `asc versions submit --id v-1`,
      updateVersion: `asc versions update --id v-1`,
      getLocalizations: `asc version-localizations list --version-id v-1`,
    }),
    new Version('v-2', appId, '1.5.0', VersionState.ReadyForSale, 'IOS', {
      getLocalizations: `asc version-localizations list --version-id v-2`,
    }),
    new Version('v-3', appId, '1.4.0', VersionState.Rejected, 'IOS', {
      checkReviewDetail: `asc review-detail get --version-id v-3`,
    }),
  ];
}
