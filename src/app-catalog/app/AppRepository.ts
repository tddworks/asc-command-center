import type { App } from './App.ts';
import type { Build } from '../../release/build/Build.ts';
import type { Version } from '../../release/version/Version.ts';

/**
 * Port for the App aggregate. Infrastructure provides two implementations
 * (REST and Mock); the domain depends only on this protocol.
 */
export interface AppRepository {
  list(): Promise<App[]>;
  get(id: string): Promise<App>;
  builds(app: App): Promise<Build[]>;
  versions(app: App): Promise<Version[]>;
}
