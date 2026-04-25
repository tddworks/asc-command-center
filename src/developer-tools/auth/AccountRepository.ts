import type { Account } from './Account.ts';

export interface LoginCredentials {
  /** Local handle the new account is registered under. */
  name: string;
  keyId: string;
  issuerId: string;
  /** Full PEM contents of the .p8 private-key file. The asc backend stores
   *  this in `~/.asc`; the client never persists it. */
  privateKeyPEM: string;
  /** Optional vendor number; can also be set later via `update`. */
  vendorNumber?: string | null;
}

export interface AccountUpdateFields {
  /** The only field a stored account exposes for editing. */
  vendorNumber: string | null;
}

/**
 * Port for the auth-account collection on the asc CLI host.
 *
 * The list response carries each row's `isActive` flag, so the aggregate
 * derives the active account from the list itself rather than making a
 * second `/active` round-trip — one call, one source of truth.
 *
 * Two distinct delete paths the backend exposes:
 *   • `clearActive()` — DELETE /accounts/active   (logout, record stays)
 *   • `remove(name)`  — DELETE /accounts/:name    (delete record entirely)
 */
export interface AccountRepository {
  /** List all stored accounts. Each carries `isActive` so the aggregate
   *  knows which one (if any) is currently active without a second call. */
  list(): Promise<Account[]>;

  /** Create + activate an account from raw credentials. Returns the created entity. */
  create(creds: LoginCredentials): Promise<Account>;

  /** Update an existing stored account in place — currently only
   *  `vendorNumber` is editable. */
  update(name: string, fields: AccountUpdateFields): Promise<Account>;

  /** Remove a stored account entirely. Different from `clearActive`,
   *  which just signs out without deleting the credentials. */
  remove(name: string): Promise<void>;

  /** Switch the active account by its local name. */
  setActive(name: string): Promise<void>;

  /** Sign out — clears the active account. Other accounts remain stored. */
  clearActive(): Promise<void>;
}
