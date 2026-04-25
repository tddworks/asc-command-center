import { makeAutoObservable, runInAction } from 'mobx';
import { Account } from './Account.ts';
import type { AccountRepository, LoginCredentials } from './AccountRepository.ts';

/**
 * Accounts — root aggregate for the asc CLI host's stored API-Key accounts.
 *
 * Owns the "is the user signed in" state for the whole app. The sidebar
 * `AuthStatus` widget observes `isAuthenticated` / `isLoading` / `error`
 * directly; the setup sheet calls `login()` and `logout()`.
 *
 * The backend doesn't expose HATEOAS affordances on these endpoints, so
 * we don't pretend it does. Capability booleans are derived from local
 * state (have we loaded? did the load fail? is there an active account?).
 */
export class Accounts {
  repository: AccountRepository;

  accounts: Account[] = [];
  active: Account | null = null;

  /** True between the first `refresh()` call and its resolution. The widget
   *  shows a "Checking…" spinner when this is true and `loaded === false`. */
  isLoading = false;

  /** Set by `refresh()` when the active-account probe fails. The widget
   *  shows a Retry button. We treat the "no active account" 404 as a
   *  successful empty result, NOT as an error — that's the unauthenticated
   *  steady state, not a failure. */
  error: Error | null = null;

  /** Has `refresh()` resolved at least once? Lets the widget distinguish
   *  "first paint" from "definitely not signed in". */
  loaded = false;

  constructor(repository: AccountRepository) {
    this.repository = repository;
    makeAutoObservable(this, { repository: false });
  }

  // ── Capability / display ──

  get isAuthenticated(): boolean {
    return this.active !== null;
  }

  get hasAnyAccount(): boolean {
    return this.accounts.length > 0;
  }

  get statusLabel(): string {
    if (this.isLoading && !this.loaded) return 'Checking…';
    if (this.error) return 'Connection failed';
    if (this.isAuthenticated) return this.active!.displayName;
    return 'Not signed in';
  }

  /** Tone for the auth dot in the footer — green when good, red on error,
   *  amber when not signed in (action required), grey while checking. */
  get statusTone(): 'success' | 'danger' | 'warning' | 'neutral' {
    if (this.isLoading && !this.loaded) return 'neutral';
    if (this.error) return 'danger';
    if (this.isAuthenticated) return 'success';
    return 'warning';
  }

  // ── Mutators ──

  /** Swap the underlying repository. Called when the app's DataMode flips
   *  from `mock` → `rest` (or vice versa) so the singleton rebinds without
   *  losing identity. Resets transient state and re-probes. */
  switchRepository(repo: AccountRepository): void {
    this.repository = repo;
    this.accounts = [];
    this.active = null;
    this.error = null;
    this.loaded = false;
    void this.refresh();
  }

  /** Reload accounts + active in parallel. Used on first mount, after
   *  login/logout, and from the Retry button. */
  async refresh(): Promise<void> {
    this.isLoading = true;
    this.error = null;
    try {
      const [list, active] = await Promise.all([
        this.repository.list(),
        this.repository.active(),
      ]);
      runInAction(() => {
        this.accounts = list;
        this.active = active;
        this.loaded = true;
      });
    } catch (err) {
      runInAction(() => {
        this.error = err as Error;
        this.loaded = true;
      });
    } finally {
      runInAction(() => { this.isLoading = false; });
    }
  }

  /** Create + activate a new account from the user's credentials. Refreshes
   *  on success so the widget reflects the new active state in one render. */
  async login(creds: LoginCredentials): Promise<Account> {
    const created = await this.repository.create(creds);
    await this.refresh();
    return created;
  }

  /** Clear the currently-active account. Other stored accounts remain so
   *  the user can switch back without re-pasting their key. */
  async logout(): Promise<void> {
    await this.repository.clearActive();
    await this.refresh();
  }

  /** Switch the active account by name. */
  async switchTo(name: string): Promise<void> {
    await this.repository.setActive(name);
    await this.refresh();
  }
}
