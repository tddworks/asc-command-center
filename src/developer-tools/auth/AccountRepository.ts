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
 * The list response carries each row's `isActive` flag, so the aggregate
 * derives the active account from the list itself rather than making a
 * second `/active` round-trip — one call, one source of truth.
 */
export interface AccountRepository {
  /** List all stored accounts. Each carries `isActive` so the aggregate
   *  knows which one (if any) is currently active without a second call. */
  list(): Promise<Account[]>;

  /** Create + activate an account from raw credentials. Returns the created entity. */
  create(creds: LoginCredentials): Promise<Account>;

  /** Switch the active account by its local name. */
  setActive(name: string): Promise<void>;

  /** Sign out — clears the active account. Other accounts remain stored. */
  clearActive(): Promise<void>;
}
