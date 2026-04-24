import { Apps } from '../app-catalog/app/Apps.ts';
import { MockAppRepository } from '../app-catalog/app/infrastructure/App.mock.ts';
import { ASCWorkspace } from './ASCWorkspace.ts';
import { LocalStorageWorkspaceStore } from './infrastructure/LocalStorage.store.ts';

/**
 * Module-level singleton. Built once at import time with the mock
 * repository as the initial source; `switchMode(restRepo)` is called
 * from the React tree once DataMode detects the REST backend.
 *
 * Hydration is fire-and-forget — consumers check `workspace.hydrated`
 * (MobX observable) and `observer()`-wrap their components so they
 * re-render when it flips true and whenever `apps` / `currentApp`
 * changes thereafter.
 *
 * No React context, no `useWorkspace()` hook — callers import the
 * singleton directly. This matches the `pluginRegistry` pattern and
 * keeps session state in the domain layer instead of React-land.
 */
export const workspace = new ASCWorkspace(
  new Apps(new MockAppRepository()),
  new LocalStorageWorkspaceStore(),
);

// Kick off initial hydration. Errors log but don't throw — the UI shows
// its "not hydrated" states until hydrate completes.
workspace.hydrate().catch((err) => {
  console.warn('[workspace] initial hydrate failed:', err);
});
