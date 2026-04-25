import { describe, it, expect, vi } from 'vitest';
import { Account } from '../../../src/developer-tools/auth/Account.ts';
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

describe('Account', () => {
  it('exposes the fields it was constructed with', () => {
    const a = new Account({ name: 'personal', keyId: 'ABCDEFGH1234', issuerId: 'issuer-x' });
    expect(a.name).toBe('personal');
    expect(a.keyId).toBe('ABCDEFGH1234');
    expect(a.issuerId).toBe('issuer-x');
    expect(a.isActive).toBe(false);
  });

  it('isActive defaults to false but accepts an explicit override', () => {
    const a = new Account({ name: 'work', keyId: 'K', issuerId: 'I', isActive: true });
    expect(a.isActive).toBe(true);
  });

  it('maskedKeyId leaves short ids alone', () => {
    expect(new Account({ name: 'n', keyId: 'SHORT', issuerId: 'I' }).maskedKeyId).toBe('SHORT');
  });

  it('maskedKeyId trims long ids to first 4 + last 4', () => {
    expect(new Account({ name: 'n', keyId: 'ABCDEFGH1234', issuerId: 'I' }).maskedKeyId)
      .toBe('ABCD…1234');
  });

  it('fromJSON accepts the canonical camelCase shape', () => {
    const a = Account.fromJSON({ name: 'personal', keyId: 'K', issuerId: 'I' });
    expect(a.name).toBe('personal');
    expect(a.keyId).toBe('K');
    expect(a.issuerId).toBe('I');
  });

  it('fromJSON tolerates snake_case from older asc backends', () => {
    const a = Account.fromJSON({ name: 'personal', key_id: 'K', issuer_id: 'I' });
    expect(a.keyId).toBe('K');
    expect(a.issuerId).toBe('I');
  });

  it('fromJSON tolerates capital-D keyID/issuerID — what the asc REST list ships', () => {
    const a = Account.fromJSON({
      name: 'default',
      keyID: '6B3CMK22CB',
      issuerID: 'd4f2fa12-5f7f-4f15-a142-b38aa1fa6062',
    });
    expect(a.keyId).toBe('6B3CMK22CB');
    expect(a.issuerId).toBe('d4f2fa12-5f7f-4f15-a142-b38aa1fa6062');
  });

  it('fromJSON reads isActive directly off the row when present', () => {
    const a = Account.fromJSON({ name: 'p', keyID: 'K', issuerID: 'I', isActive: true });
    expect(a.isActive).toBe(true);
  });

  it('fromJSON threads the active flag through opts when the row lacks it', () => {
    const a = Account.fromJSON({ name: 'p', keyId: 'K', issuerId: 'I' }, { isActive: true });
    expect(a.isActive).toBe(true);
  });

  it('fromJSON: row-level isActive wins over opts', () => {
    const a = Account.fromJSON({ name: 'p', keyId: 'K', issuerId: 'I', isActive: false }, { isActive: true });
    expect(a.isActive).toBe(false);
  });

  it('fromJSON reads vendorNumber when present', () => {
    const a = Account.fromJSON({ name: 'p', keyID: 'K', issuerID: 'I', vendorNumber: '92488713' });
    expect(a.vendorNumber).toBe('92488713');
  });

  it('vendorNumber defaults to null', () => {
    const a = new Account({ name: 'p', keyId: 'K', issuerId: 'I' });
    expect(a.vendorNumber).toBeNull();
  });

  // ── Editable vendorNumber ──

  it('setVendorNumber flips dirty', () => {
    const a = new Account({ name: 'p', keyId: 'K', issuerId: 'I' });
    a.setVendorNumber('92488713');
    expect(a.vendorNumber).toBe('92488713');
    expect(a.hasUnsavedChanges).toBe(true);
  });

  it('setVendorNumber treats empty / whitespace as null', () => {
    const a = new Account({ name: 'p', keyId: 'K', issuerId: 'I', vendorNumber: '12345' });
    a.setVendorNumber('');
    expect(a.vendorNumber).toBeNull();
    a.setVendorNumber('   ');
    expect(a.vendorNumber).toBeNull();
  });

  it('discard restores the last-saved vendorNumber', () => {
    const a = new Account({ name: 'p', keyId: 'K', issuerId: 'I', vendorNumber: '12345' });
    a.setVendorNumber('99999');
    a.discard();
    expect(a.vendorNumber).toBe('12345');
    expect(a.hasUnsavedChanges).toBe(false);
  });

  // ── save / delete ──

  it('save delegates to repository.update with the current vendorNumber', async () => {
    const repo = stubRepo();
    const a = new Account({ name: 'personal', keyId: 'K', issuerId: 'I' });
    a.setRepository(repo);
    a.setVendorNumber('92488713');

    await a.save();

    expect(repo.update).toHaveBeenCalledWith('personal', { vendorNumber: '92488713' });
    expect(a.hasUnsavedChanges).toBe(false);
  });

  it('save throws without a repository attached', async () => {
    const a = new Account({ name: 'p', keyId: 'K', issuerId: 'I' });
    await expect(a.save()).rejects.toThrow(/no repository/i);
  });

  it('delete delegates to repository.remove', async () => {
    const repo = stubRepo();
    const a = new Account({ name: 'work', keyId: 'K', issuerId: 'I' });
    a.setRepository(repo);

    await a.delete();

    expect(repo.remove).toHaveBeenCalledWith('work');
  });

  it('delete throws without a repository attached', async () => {
    const a = new Account({ name: 'p', keyId: 'K', issuerId: 'I' });
    await expect(a.delete()).rejects.toThrow(/no repository/i);
  });
});
