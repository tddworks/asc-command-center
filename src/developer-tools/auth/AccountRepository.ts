import type { Account } from './Account.ts';

export interface LoginCredentials {
  /** Local handle the new account is registered under. */
  name: string;
  keyId: string;
  issuerId: string;
  /** Full PEM contents of the .p8 private-key file. The asc backend stores
   *  this in `~/.asc`; the client never persists it. */
  privateKeyPEM: string;
}

/**
 * Port for the auth-account collection on the asc CLI host.
 *
 * The backend exposes a small CRUD surface — list, active, create, switch,
 * clear — and that's exactly the shape repositories need to implement. The
 * domain aggregate (`Accounts`) orchestrates these; UI never speaks HTTP.
 */
export interface AccountRepository {
  /** List all stored accounts. */
  list(): Promise<Account[]>;

  /** Resolve the currently-active account, or null if no account is configured. */
  active(): Promise<Account | null>;

  /** Create + activate an account from raw credentials. Returns the created entity. */
  create(creds: LoginCredentials): Promise<Account>;

  /** Switch the active account by its local name. */
  setActive(name: string): Promise<void>;

  /** Sign out — clears the active account. Other accounts remain stored. */
  clearActive(): Promise<void>;
}
