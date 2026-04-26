import { reaction } from 'mobx';
import { SubscriptionGroups } from './SubscriptionGroups.ts';
import { MockSubscriptionGroupRepository } from './infrastructure/SubscriptionGroup.mock.ts';
import { workspace } from '../../workspace/workspaceInstance.ts';
import type { SubscriptionGroupRepository } from './SubscriptionGroupRepository.ts';

/**
 * Module-level singleton mirroring `iaps`. Built once with the mock repo;
 * the App-level mode bridge re-binds the REST repo via
 * `bindSubscriptionGroupRepository(repo)`. Pages wrap in `observer()`
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

/**
 * Atomically swap the repository AND re-fetch for the current app — see
 * `bindIapRepository` for why a plain `switchRepository` call leaves the
 * page stuck on the loading spinner.
 */
export function bindSubscriptionGroupRepository(repo: SubscriptionGroupRepository): void {
  subscriptionGroups.switchRepository(repo);
  const appId = workspace.currentApp?.id;
  if (appId) {
    void subscriptionGroups.refreshFor(appId).catch((err) => {
      console.warn('[subscription-groups] refresh after switchRepository failed:', err);
    });
  }
}
