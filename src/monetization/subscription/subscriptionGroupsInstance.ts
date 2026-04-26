import { reaction } from 'mobx';
import { SubscriptionGroups } from './SubscriptionGroups.ts';
import { MockSubscriptionGroupRepository } from './infrastructure/SubscriptionGroup.mock.ts';
import { workspace } from '../../workspace/workspaceInstance.ts';

/**
 * Module-level singleton mirroring `iaps`. Built once with the mock repo;
 * the App-level mode bridge re-binds the REST repo via
 * `subscriptionGroups.switchRepository(repo)`. Pages wrap in `observer()`
 * and read this instance directly — no React context, no hook.
 */
export const subscriptionGroups = new SubscriptionGroups(new MockSubscriptionGroupRepository());

reaction(
  () => workspace.currentApp?.id ?? null,
  (appId) => {
    if (!appId) return;
    void subscriptionGroups.refreshFor(appId).catch((err) => {
      console.warn('[subscription-groups] refresh failed:', err);
    });
  },
  { fireImmediately: true },
);
