import { describe, it, expect, vi } from 'vitest';
import { Account } from '../../../src/developer-tools/auth/Account.ts';
import { Accounts } from '../../../src/developer-tools/auth/Accounts.ts';
import type { AccountRepository } from '../../../src/developer-tools/auth/AccountRepository.ts';

function stubRepo(overrides: Partial<AccountRepository> = {}): AccountRepository {
  return {
    list: vi.fn().mockResolvedValue([]),
    active: vi.fn().mockResolvedValue(null),
    create: vi.fn(),
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

  it('statusLabel reads "Not signed in" when refresh resolves with no active account', async () => {
    const a = new Accounts(stubRepo({ active: vi.fn().mockResolvedValue(null) }));
    await a.refresh();
    expect(a.statusLabel).toBe('Not signed in');
    expect(a.statusTone).toBe('warning');
  });

  it('statusLabel uses the active account name when authenticated', async () => {
    const personal = new Account({ name: 'personal', keyId: 'K', issuerId: 'I', isActive: true });
    const a = new Accounts(stubRepo({
      list: vi.fn().mockResolvedValue([personal]),
      active: vi.fn().mockResolvedValue(personal),
    }));
    await a.refresh();
    expect(a.statusLabel).toBe('personal');
    expect(a.statusTone).toBe('success');
    expect(a.isAuthenticated).toBe(true);
  });

  it('statusLabel reads "Connection failed" when the active probe throws', async () => {
    const a = new Accounts(stubRepo({
      active: vi.fn().mockRejectedValue(new Error('ECONNREFUSED')),
    }));
    await a.refresh();
    expect(a.statusLabel).toBe('Connection failed');
    expect(a.statusTone).toBe('danger');
    expect(a.error?.message).toBe('ECONNREFUSED');
  });

  // ── refresh ──

  it('refresh populates accounts + active and flips loaded', async () => {
    const personal = new Account({ name: 'personal', keyId: 'K', issuerId: 'I' });
    const repo = stubRepo({
      list: vi.fn().mockResolvedValue([personal]),
      active: vi.fn().mockResolvedValue(personal),
    });
    const a = new Accounts(repo);
    await a.refresh();
    expect(a.accounts).toEqual([personal]);
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
      active: vi.fn().mockResolvedValue(created),
    });
    const a = new Accounts(repo);

    const result = await a.login({ name: 'personal', keyId: 'K', issuerId: 'I', privateKeyPEM: '---' });

    expect(result).toBe(created);
    expect(repo.create).toHaveBeenCalledWith({ name: 'personal', keyId: 'K', issuerId: 'I', privateKeyPEM: '---' });
    expect(a.isAuthenticated).toBe(true);
    expect(a.active?.name).toBe('personal');
  });

  it('logout delegates to repository.clearActive and refreshes', async () => {
    const repo = stubRepo({
      list: vi.fn().mockResolvedValue([]),
      active: vi.fn().mockResolvedValue(null),
    });
    const a = new Accounts(repo);
    await a.logout();
    expect(repo.clearActive).toHaveBeenCalledTimes(1);
    expect(a.isAuthenticated).toBe(false);
  });

  it('switchTo delegates to repository.setActive with the chosen name', async () => {
    const work = new Account({ name: 'work', keyId: 'K', issuerId: 'I' });
    const repo = stubRepo({
      list: vi.fn().mockResolvedValue([work]),
      active: vi.fn().mockResolvedValue(work),
    });
    const a = new Accounts(repo);
    await a.switchTo('work');
    expect(repo.setActive).toHaveBeenCalledWith('work');
    expect(a.active?.name).toBe('work');
  });
});
