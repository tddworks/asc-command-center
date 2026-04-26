import { reaction } from 'mobx';
import { InAppPurchases } from './InAppPurchases.ts';
import { MockInAppPurchaseRepository } from './infrastructure/InAppPurchase.mock.ts';
import { workspace } from '../../workspace/workspaceInstance.ts';
import type { InAppPurchaseRepository } from './InAppPurchaseRepository.ts';

/**
 * Module-level singleton mirroring `workspace`, `installedPlugins`, etc.
 * Built once with the mock repo; the App-level mode bridge re-binds the
 * REST repo via `bindIapRepository(repo)`. Pages wrap in `observer()` and
 * read this instance directly — no React context, no hook.
 *
 * A MobX `reaction` watches `workspace.currentApp` so flipping the app
 * (sidebar pin) auto-loads the IAP list for the new app.
 */
export const iaps = new InAppPurchases(new MockInAppPurchaseRepository());

reaction(
  () => workspace.currentApp?.id ?? null,
  (appId) => {
    if (!appId) return;
    void iaps.refreshFor(appId).catch((err) => {
      console.warn('[iaps] refresh failed:', err);
    });
  },
  { fireImmediately: true },
);

/**
 * Atomically swap the repository AND re-fetch for the current app.
 *
 * `switchRepository` resets `loaded` to false. If the bridge calls it
 * after the boot-time reaction has already populated the list, we'd be
 * stuck on the loading spinner forever — the reaction won't re-fire
 * because `workspace.currentApp.id` hasn't changed. Binding through
 * this helper guarantees a refresh after every repo swap.
 */
export function bindIapRepository(repo: InAppPurchaseRepository): void {
  iaps.switchRepository(repo);
  const appId = workspace.currentApp?.id;
  if (appId) {
    void iaps.refreshFor(appId).catch((err) => {
      console.warn('[iaps] refresh after switchRepository failed:', err);
    });
  }
}
