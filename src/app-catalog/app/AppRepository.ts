import type { App } from './App.ts';
import type { Build } from '../../release/build/Build.ts';
import type { Version, NewVersionInit } from '../../release/version/Version.ts';
import type { AppInfo } from '../app-info/AppInfo.ts';

/**
 * Port for the App aggregate. Infrastructure provides two implementations
 * (REST and Mock); the domain depends only on this protocol.
 *
 * `createVersion` lives here (not on `VersionRepository`) because the new
 * Version resource is created under an existing App — the affordance is
 * `app.affordances.createVersion` and the REST call is
 * `POST /api/v1/apps/{app.id}/versions`.
 */
export interface AppRepository {
  list(): Promise<App[]>;
  get(id: string): Promise<App>;
  builds(app: App): Promise<Build[]>;
  versions(app: App): Promise<Version[]>;
  createVersion(app: App, init: NewVersionInit): Promise<Version>;
  /** Load all AppInfo rows (one per version state) for the given app. The
   *  domain picks the row matching the currently-selected version's state
   *  via `App.appInfoFor(state)`. */
  appInfos(app: App): Promise<AppInfo[]>;
  /** Update the App resource itself — currently only `contentRightsDeclaration`
   *  is editable here (AppInfo owns categories, AppInfoLocalization owns
   *  privacy URLs, AgeRatingDeclaration owns the questionnaire). Maps to
   *  `PATCH /api/v1/apps/:appId`. */
  updateContentRights(app: App): Promise<void>;
}
