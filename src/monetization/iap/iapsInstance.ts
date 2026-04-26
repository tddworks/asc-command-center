import { reaction } from 'mobx';
import { InAppPurchases } from './InAppPurchases.ts';
import { MockInAppPurchaseRepository } from './infrastructure/InAppPurchase.mock.ts';
import { workspace } from '../../workspace/workspaceInstance.ts';

/**
 * Module-level singleton mirroring `workspace`, `installedPlugins`, etc.
 * Built once with the mock repo; the App-level mode bridge re-binds the
 * REST repo via `iaps.switchRepository(repo)`. Pages wrap in `observer()`
 * and read this instance directly — no React context, no hook.
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
