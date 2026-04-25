import { describe, it, expect, vi } from 'vitest';
import { Account } from '../../../src/developer-tools/auth/Account.ts';
import { Accounts } from '../../../src/developer-tools/auth/Accounts.ts';
import type { AccountRepository } from '../../../src/developer-tools/auth/AccountRepository.ts';

function stubRepo(overrides: Partial<AccountRepository> = {}): AccountRepository {
  return {
    list: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    update: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
    setActive: vi.fn().mockResolvedValue(undefined),
    clearActive: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('Accounts', () => {

  // ── Initial state ──

  it('starts unauthenticated, unloaded, idle', () => {
    const a = new Accounts(stubRepo());
    expect(a.isAuthenticated).toBe(false);
    expect(a.hasAnyAccount).toBe(false);
    expect(a.loaded).toBe(false);
    expect(a.isLoading).toBe(false);
    expect(a.error).toBeNull();
  });

  // ── Display ──

  it('statusLabel reads "Checking…" while the first refresh is in flight', () => {
    const a = new Accounts(stubRepo());
    a.isLoading = true; // simulating mid-refresh before the first resolve
    expect(a.statusLabel).toBe('Checking…');
    expect(a.statusTone).toBe('neutral');
  });

  it('statusLabel reads "Not signed in" when refresh resolves with no accounts', async () => {
    const a = new Accounts(stubRepo({ list: vi.fn().mockResolvedValue([]) }));
    await a.refresh();
    expect(a.statusLabel).toBe('Not signed in');
    expect(a.statusTone).toBe('warning');
  });

  it('statusLabel reads "Not signed in" when no listed account is active', async () => {
    const work = new Account({ name: 'work', keyId: 'K', issuerId: 'I', isActive: false });
    const a = new Accounts(stubRepo({ list: vi.fn().mockResolvedValue([work]) }));
    await a.refresh();
    expect(a.statusLabel).toBe('Not signed in');
  });

  it('statusLabel uses the active account name when one row carries isActive=true', async () => {
    const personal = new Account({ name: 'personal', keyId: 'K', issuerId: 'I', isActive: true });
    const a = new Accounts(stubRepo({ list: vi.fn().mockResolvedValue([personal]) }));
    await a.refresh();
    expect(a.statusLabel).toBe('personal');
    expect(a.statusTone).toBe('success');
    expect(a.isAuthenticated).toBe(true);
  });

  it('statusLabel reads "Connection failed" when the list probe throws', async () => {
    const a = new Accounts(stubRepo({
      list: vi.fn().mockRejectedValue(new Error('ECONNREFUSED')),
    }));
    await a.refresh();
    expect(a.statusLabel).toBe('Connection failed');
    expect(a.statusTone).toBe('danger');
    expect(a.error?.message).toBe('ECONNREFUSED');
  });

  // ── refresh ──

  it('refresh derives active from the row marked isActive', async () => {
    const personal = new Account({ name: 'personal', keyId: 'K', issuerId: 'I', isActive: true });
    const work = new Account({ name: 'work', keyId: 'K2', issuerId: 'I', isActive: false });
    const repo = stubRepo({ list: vi.fn().mockResolvedValue([personal, work]) });
    const a = new Accounts(repo);
    await a.refresh();
    expect(a.accounts).toEqual([personal, work]);
    expect(a.active).toBe(personal);
    expect(a.loaded).toBe(true);
    expect(a.isLoading).toBe(false);
  });

  it('refresh keeps loaded=true and surfaces the error on failure', async () => {
    const failure = new Error('boom');
    const repo = stubRepo({ list: vi.fn().mockRejectedValue(failure) });
    const a = new Accounts(repo);
    await a.refresh();
    expect(a.error).toBe(failure);
    expect(a.loaded).toBe(true);
    expect(a.isLoading).toBe(false);
  });

  // ── login / logout / switchTo ──

  it('login delegates to repository.create and refreshes', async () => {
    const created = new Account({ name: 'personal', keyId: 'K', issuerId: 'I', isActive: true });
    const repo = stubRepo({
      create: vi.fn().mockResolvedValue(created),
      list: vi.fn().mockResolvedValue([created]),
    });
    const a = new Accounts(repo);

    const result = await a.login({ name: 'personal', keyId: 'K', issuerId: 'I', privateKeyPEM: '---' });

    expect(result).toBe(created);
    expect(repo.create).toHaveBeenCalledWith({ name: 'personal', keyId: 'K', issuerId: 'I', privateKeyPEM: '---' });
    expect(a.isAuthenticated).toBe(true);
    expect(a.active?.name).toBe('personal');
  });

  it('logout delegates to repository.clearActive and refreshes', async () => {
    const repo = stubRepo({ list: vi.fn().mockResolvedValue([]) });
    const a = new Accounts(repo);
    await a.logout();
    expect(repo.clearActive).toHaveBeenCalledTimes(1);
    expect(a.isAuthenticated).toBe(false);
  });

  it('switchTo delegates to repository.setActive with the chosen name', async () => {
    const work = new Account({ name: 'work', keyId: 'K', issuerId: 'I', isActive: true });
    const repo = stubRepo({ list: vi.fn().mockResolvedValue([work]) });
    const a = new Accounts(repo);
    await a.switchTo('work');
    expect(repo.setActive).toHaveBeenCalledWith('work');
    expect(a.active?.name).toBe('work');
  });

  // ── deleteAccount + repo cascade ──

  it('refresh attaches the repository to every loaded account', async () => {
    const personal = new Account({ name: 'personal', keyId: 'K', issuerId: 'I', isActive: true });
    const work = new Account({ name: 'work', keyId: 'K2', issuerId: 'I' });
    const repo = stubRepo({ list: vi.fn().mockResolvedValue([personal, work]) });
    const a = new Accounts(repo);
    await a.refresh();
    expect(personal.repository).toBe(repo);
    expect(work.repository).toBe(repo);
  });

  it('deleteAccount removes the record and refreshes', async () => {
    const personal = new Account({ name: 'personal', keyId: 'K', issuerId: 'I', isActive: true });
    const work = new Account({ name: 'work', keyId: 'K2', issuerId: 'I' });
    const list = vi.fn()
      .mockResolvedValueOnce([personal, work])
      .mockResolvedValueOnce([personal]);
    const repo = stubRepo({ list });
    const a = new Accounts(repo);
    await a.refresh();

    await a.deleteAccount('work');

    expect(repo.remove).toHaveBeenCalledWith('work');
    expect(a.accounts.map((x) => x.name)).toEqual(['personal']);
  });

  it('deleteAccount on the active account leaves the user signed out after refresh', async () => {
    const personal = new Account({ name: 'personal', keyId: 'K', issuerId: 'I', isActive: true });
    const list = vi.fn()
      .mockResolvedValueOnce([personal])
      .mockResolvedValueOnce([]);
    const repo = stubRepo({ list });
    const a = new Accounts(repo);
    await a.refresh();

    await a.deleteAccount('personal');

    expect(a.active).toBeNull();
    expect(a.isAuthenticated).toBe(false);
  });
});
