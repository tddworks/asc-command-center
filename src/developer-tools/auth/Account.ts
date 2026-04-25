import { makeAutoObservable } from 'mobx';

export interface AccountInit {
  /** Local handle (e.g. "personal", "work") — the asc CLI uses this as the
   *  identifier when listing or switching accounts. Immutable from the
   *  user's perspective: switching name = create a new account. */
  name: string;
  /** Apple Team API Key ID (from App Store Connect → Users and Access → Keys). */
  keyId: string;
  /** Apple Team Issuer ID (the team-wide issuer, not per-key). */
  issuerId: string;
  /** Whether this account is the currently-active one for asc commands. */
  isActive?: boolean;
}

/**
 * Account — one stored Apple Team API Key entry on the asc CLI host.
 *
 * Intentionally thin: identity-only. The private key never lives on the
 * client and the backend doesn't expose HATEOAS affordances on this
 * resource, so the aggregate owns lifecycle (login / logout / switch)
 * rather than the entity itself.
 */
export class Account {
  readonly name: string;
  readonly keyId: string;
  readonly issuerId: string;
  isActive: boolean;

  constructor(init: AccountInit) {
    this.name = init.name;
    this.keyId = init.keyId;
    this.issuerId = init.issuerId;
    this.isActive = init.isActive ?? false;
    makeAutoObservable(this, { name: false, keyId: false, issuerId: false });
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
      isActive: (json.isActive as boolean | undefined) ?? opts.isActive ?? false,
    });
  }
}
