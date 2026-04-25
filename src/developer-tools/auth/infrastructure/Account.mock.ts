import { Account } from '../Account.ts';
import type { AccountRepository, LoginCredentials } from '../AccountRepository.ts';

/**
 * In-memory MockAccountRepository — simulates the asc CLI's auth store.
 * Starts unauthenticated by default so the AuthStatus widget exercises its
 * "Not signed in → setup" path on first paint in mock mode.
 *
 * Logging in via the setup sheet adds an account here and marks it active;
 * the mock then behaves like a real signed-in session.
 */
export class MockAccountRepository implements AccountRepository {
  private accounts: Map<string, Account> = new Map();
  private activeName: string | null = null;

  async list(): Promise<Account[]> {
    return [...this.accounts.values()].map((a) =>
      new Account({ name: a.name, keyId: a.keyId, issuerId: a.issuerId, isActive: a.name === this.activeName }),
    );
  }

  async active(): Promise<Account | null> {
    if (!this.activeName) return null;
    const found = this.accounts.get(this.activeName);
    if (!found) return null;
    return new Account({ name: found.name, keyId: found.keyId, issuerId: found.issuerId, isActive: true });
  }

  async create(creds: LoginCredentials): Promise<Account> {
    const account = new Account({
      name: creds.name,
      keyId: creds.keyId,
      issuerId: creds.issuerId,
      isActive: true,
    });
    this.accounts.set(creds.name, account);
    this.activeName = creds.name;
    return account;
  }

  async setActive(name: string): Promise<void> {
    if (!this.accounts.has(name)) {
      throw new Error(`Account '${name}' not found`);
    }
    this.activeName = name;
  }

  async clearActive(): Promise<void> {
    this.activeName = null;
  }
}
