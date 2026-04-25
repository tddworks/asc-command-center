import { Accounts } from './Accounts.ts';
import { MockAccountRepository } from './infrastructure/Account.mock.ts';

/**
 * Module-level singleton mirroring `workspace`. Built once at import time
 * with the mock repository; `accounts.switchRepository(restRepo)` is called
 * from the React tree once DataMode detects the REST backend.
 *
 * Auth state must be a singleton — the sidebar status widget and the
 * setup sheet have to observe the same instance, otherwise login in the
 * sheet wouldn't update the footer. No React context, no `useAccounts()`
 * hook; callers import the singleton directly and wrap in `observer()`.
 */
export const accounts = new Accounts(new MockAccountRepository());

// Kick off the first probe. Errors land on `accounts.error` and surface
// through the AuthStatus widget's "Connection failed · Retry" branch.
accounts.refresh().catch((err) => {
  console.warn('[accounts] initial refresh failed:', err);
});
