import type { App } from './App.ts';
import type { Build } from '../../release/build/Build.ts';
import type { Version, NewVersionInit } from '../../release/version/Version.ts';

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
}
