import { Account } from '../Account.ts';
import type { AccountRepository, AccountUpdateFields, LoginCredentials } from '../AccountRepository.ts';
import type { DataMode } from '../../../shared/api-client.tsx';
import { MockAccountRepository } from './Account.mock.ts';

/**
 * REST adapter for the asc CLI's `/api/v1/auth/accounts` endpoints.
 *
 * Endpoints (per the asc backend's `AuthController`):
 *   POST   /api/v1/auth/accounts          → login (returns AuthStatus)
 *   GET    /api/v1/auth/accounts          → list   (returns ConnectAccount[])
 *   GET    /api/v1/auth/accounts/active   → active (returns AuthStatus | 404)
 *   PATCH  /api/v1/auth/accounts/active   → switch ({ name })
 *   DELETE /api/v1/auth/accounts/active   → logout
 *
 * Responses follow the project-wide `{"data": …}` Presentable wrapper. We
 * unwrap once at the adapter boundary; the rest of the slice sees domain
 * objects only.
 *
 * Security note: login bodies carry the .p8 PEM. Run `asc web-server`
 * bound to loopback only when this controller is enabled — anything else
 * leaks credentials.
 */
const BASE = '/api/v1/auth/accounts';

export class RestAccountRepository implements AccountRepository {
  async list(): Promise<Account[]> {
    const resp = await fetch(BASE, { headers: { Accept: 'application/json' } });
    if (!resp.ok) throw new Error(`GET ${BASE} failed: ${resp.status}`);
    const json = await resp.json();
    const rows = unwrapList(json);
    // Each row carries `isActive`, `keyID`, `issuerID` — `Account.fromJSON`
    // accepts all the casing variants the backend has shipped.
    return rows.map((row) => Account.fromJSON(row));
  }

  async create(creds: LoginCredentials): Promise<Account> {
    const resp = await fetch(BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(creds),
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new Error(`POST ${BASE} failed: ${resp.status} ${text}`);
    }
    const json = await resp.json().catch(() => ({}));
    // POST returns `AuthStatus`, which may put the account at the root,
    // under `account`, or under `active`. Fall back to the credentials we
    // sent if the response shape isn't recognisable — the next refresh()
    // will fetch the authoritative state anyway.
    const account = pickAccount(unwrap(json)) ?? {
      name: creds.name,
      keyId: creds.keyId,
      issuerId: creds.issuerId,
    };
    return Account.fromJSON(account, { isActive: true });
  }

  async update(name: string, fields: AccountUpdateFields): Promise<Account> {
    const url = `${BASE}/${encodeURIComponent(name)}`;
    const resp = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ vendorNumber: fields.vendorNumber }),
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new Error(`PATCH ${url} failed: ${resp.status} ${text}`);
    }
    const json = await resp.json().catch(() => ({}));
    const row = pickAccount(unwrap(json));
    if (row) return Account.fromJSON(row);
    // Fall back to a synthetic record from the inputs if the response shape
    // changes — `Accounts.refresh()` will fetch the authoritative state.
    return new Account({ name, keyId: '', issuerId: '', vendorNumber: fields.vendorNumber });
  }

  async remove(name: string): Promise<void> {
    const url = `${BASE}/${encodeURIComponent(name)}`;
    const resp = await fetch(url, { method: 'DELETE' });
    // 204 success; 404 means the record was already gone, which is also fine
    // (idempotent delete).
    if (!resp.ok && resp.status !== 404) {
      const text = await resp.text().catch(() => '');
      throw new Error(`DELETE ${url} failed: ${resp.status} ${text}`);
    }
  }

  async setActive(name: string): Promise<void> {
    const resp = await fetch(`${BASE}/active`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new Error(`PATCH ${BASE}/active failed: ${resp.status} ${text}`);
    }
  }

  async clearActive(): Promise<void> {
    const resp = await fetch(`${BASE}/active`, { method: 'DELETE' });
    // 204 is success; 404 means already cleared, which is also success.
    if (!resp.ok && resp.status !== 404) {
      const text = await resp.text().catch(() => '');
      throw new Error(`DELETE ${BASE}/active failed: ${resp.status} ${text}`);
    }
  }
}

/** Unwrap `{"data": X}` → `X`, leaving anything else alone. */
function unwrap(json: unknown): unknown {
  if (json && typeof json === 'object' && 'data' in json) {
    return (json as { data: unknown }).data;
  }
  return json;
}

function unwrapList(json: unknown): Record<string, unknown>[] {
  const inner = unwrap(json);
  if (Array.isArray(inner)) return inner as Record<string, unknown>[];
  return [];
}

/** AuthStatus payloads vary in shape across asc revisions: sometimes the
 *  account is at the root, sometimes nested under `account` / `active`.
 *  Probe each location and return the first one that looks right. */
function pickAccount(payload: unknown): Record<string, unknown> | null {
  if (!payload || typeof payload !== 'object') return null;
  const obj = payload as Record<string, unknown>;
  if (typeof obj.name === 'string' && (typeof obj.keyId === 'string' || typeof obj.key_id === 'string')) {
    return obj;
  }
  if (obj.account && typeof obj.account === 'object') return obj.account as Record<string, unknown>;
  if (obj.active && typeof obj.active === 'object') return obj.active as Record<string, unknown>;
  return null;
}

export async function repositoryFor(mode: DataMode): Promise<AccountRepository> {
  if (mode === 'mock') return new MockAccountRepository();
  return new RestAccountRepository();
}
