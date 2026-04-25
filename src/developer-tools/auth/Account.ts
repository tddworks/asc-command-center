import { makeAutoObservable, runInAction } from 'mobx';
import type { AccountRepository } from './AccountRepository.ts';

export interface AccountInit {
  /** Local handle (e.g. "personal", "work") — the asc CLI uses this as the
   *  identifier when listing or switching accounts. Immutable from the
   *  user's perspective: switching name = create a new account. */
  name: string;
  /** Apple Team API Key ID (from App Store Connect → Users and Access → Keys). */
  keyId: string;
  /** Apple Team Issuer ID (the team-wide issuer, not per-key). */
  issuerId: string;
  /** Vendor number for sales / financial reports — null until the user
   *  fills it in. The only field on a stored account that's editable. */
  vendorNumber?: string | null;
  /** Whether this account is the currently-active one for asc commands. */
  isActive?: boolean;
}

interface Snapshot {
  vendorNumber: string | null;
}

/**
 * Account — one stored Apple Team API Key entry on the asc CLI host.
 *
 * Self-persisting: the entity owns its own save/delete lifecycle through
 * its repository reference (cascaded from the parent `Accounts` aggregate
 * after a refresh). The only editable field is `vendorNumber`; identity
 * (name, keyId, issuerId) is fixed once a key is registered.
 */
export class Account {
  readonly name: string;
  readonly keyId: string;
  readonly issuerId: string;
  vendorNumber: string | null;
  isActive: boolean;

  /** Set by the parent aggregate after `refresh()` so the entity can
   *  save and delete itself. Null until attached. */
  repository: AccountRepository | null = null;

  private snapshot: Snapshot;

  constructor(init: AccountInit) {
    this.name = init.name;
    this.keyId = init.keyId;
    this.issuerId = init.issuerId;
    this.vendorNumber = init.vendorNumber ?? null;
    this.isActive = init.isActive ?? false;
    this.snapshot = this.capture();
    makeAutoObservable(this, {
      name: false, keyId: false, issuerId: false, repository: false,
    });
  }

  setRepository(repo: AccountRepository): void {
    this.repository = repo;
  }

  // ── Setters ──

  setVendorNumber(v: string | null): void {
    // Treat empty strings as null so dirty tracking and the backend agree
    // on "no value" (the API expects null/missing, not "").
    this.vendorNumber = v && v.trim().length > 0 ? v.trim() : null;
  }

  // ── Display ──

  get displayName(): string {
    return this.name;
  }

  /** Short, masked label for the key id ("ABCD…XYZ9") — full key id is
   *  long and visually noisy in the sidebar footer. */
  get maskedKeyId(): string {
    if (this.keyId.length <= 8) return this.keyId;
    return `${this.keyId.slice(0, 4)}…${this.keyId.slice(-4)}`;
  }

  // ── Dirty tracking ──

  get hasUnsavedChanges(): boolean {
    return this.vendorNumber !== this.snapshot.vendorNumber;
  }

  /** Restore the last-saved values — used by the manager sheet's per-row
   *  Cancel button to abandon an in-progress edit. */
  discard(): void {
    this.vendorNumber = this.snapshot.vendorNumber;
  }

  markSaved(): void {
    this.snapshot = this.capture();
  }

  // ── Self-persistence ──

  async save(): Promise<void> {
    if (!this.repository) {
      throw new Error(`Account ${this.name} has no repository attached`);
    }
    await this.repository.update(this.name, { vendorNumber: this.vendorNumber });
    runInAction(() => this.markSaved());
  }

  /** Remove this stored account from the asc CLI's credentials. The parent
   *  aggregate is responsible for refreshing its list afterwards. */
  async delete(): Promise<void> {
    if (!this.repository) {
      throw new Error(`Account ${this.name} has no repository attached`);
    }
    await this.repository.remove(this.name);
  }

  // ── Factory ──

  /** Permissive on input — the asc backend ships `keyID`/`issuerID` with a
   *  capital D, older fixtures used `keyId`, and snake_case has appeared in
   *  one revision. Accept all three. `isActive` is read straight off the
   *  row when present (the list endpoint includes it) and falls back to an
   *  explicit `opts` override for endpoints that don't. */
  static fromJSON(json: Record<string, unknown>, opts: { isActive?: boolean } = {}): Account {
    return new Account({
      name: (json.name as string) ?? '',
      keyId:
        (json.keyId as string) ??
        (json.keyID as string) ??
        (json.key_id as string) ??
        '',
      issuerId:
        (json.issuerId as string) ??
        (json.issuerID as string) ??
        (json.issuer_id as string) ??
        '',
      vendorNumber: (json.vendorNumber as string | null | undefined) ?? null,
      isActive: (json.isActive as boolean | undefined) ?? opts.isActive ?? false,
    });
  }

  private capture(): Snapshot {
    return { vendorNumber: this.vendorNumber };
  }
}
