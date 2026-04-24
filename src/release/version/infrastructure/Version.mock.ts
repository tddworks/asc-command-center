import { Version, VersionState, Platform, type NewVersionInit } from '../Version.ts';
import type { VersionRepository } from '../VersionRepository.ts';

/**
 * Shared in-memory version store across both mock and REST-fallback paths.
 * Seeds deterministic fixtures per-app the first time an app is touched so
 * the UI sees stable data in mock mode. Exposes `append` so `createVersion`
 * can mutate the list and subsequent `list(appId)` calls reflect the change.
 */
interface VersionRow {
  id: string;
  versionString: string;
  state: VersionState;
  platform: string;
  affordances: Record<string, string>;
}

const store: Map<string, VersionRow[]> = new Map();
let idSeed = 9000;

function seedFor(_appId: string): VersionRow[] {
  return [
    {
      id: 'v-1',
      versionString: '2.0.0',
      state: VersionState.PrepareForSubmission,
      platform: Platform.iOS,
      affordances: {
        submitForReview: `/api/v1/versions/v-1/submissions`,
        updateVersion: `/api/v1/versions/v-1`,
        getLocalizations: `/api/v1/versions/v-1/localizations`,
      },
    },
    {
      id: 'v-2',
      versionString: '1.5.0',
      state: VersionState.ReadyForSale,
      platform: Platform.iOS,
      affordances: {
        getLocalizations: `/api/v1/versions/v-2/localizations`,
      },
    },
    {
      id: 'v-3',
      versionString: '1.4.0',
      state: VersionState.Rejected,
      platform: Platform.iOS,
      affordances: {
        checkReviewDetail: `/api/v1/versions/v-3/review-detail`,
        updateVersion: `/api/v1/versions/v-3`,
      },
    },
  ];
}

function rowsFor(appId: string): VersionRow[] {
  if (!store.has(appId)) store.set(appId, seedFor(appId));
  return store.get(appId)!;
}

function hydrate(row: VersionRow, appId: string, repo: VersionRepository): Version {
  const v = new Version({
    id: row.id,
    appId,
    versionString: row.versionString,
    state: row.state,
    platform: row.platform,
    affordances: { ...row.affordances },
  });
  v.setRepository(repo);
  return v;
}

/** Used by MockAppRepository.versions() — returns hydrated Versions with
 *  the given repository attached so every returned instance can navigate. */
export function mockVersionsWithRepo(appId: string, repo: VersionRepository): Version[] {
  return rowsFor(appId).map((row) => hydrate(row, appId, repo));
}

/** Mock implementation of `createVersion` used by MockAppRepository and by
 *  the REST adapter as a fallback when `createVersion` affordance is absent.
 *  Appends to the store, returns a hydrated Version with the given repo. */
export function mockAppendVersion(
  appId: string,
  init: NewVersionInit,
  repo: VersionRepository,
): Version {
  const id = `mock-version-${idSeed++}`;
  const row: VersionRow = {
    id,
    versionString: init.versionString,
    state: VersionState.PrepareForSubmission,
    platform: init.platform,
    affordances: {
      updateVersion: `/api/v1/versions/${id}`,
      getLocalizations: `/api/v1/versions/${id}/localizations`,
      submitForReview: `/api/v1/versions/${id}/submissions`,
    },
  };
  rowsFor(appId).push(row);
  return hydrate(row, appId, repo);
}
