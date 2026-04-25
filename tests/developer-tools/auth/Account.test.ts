import { describe, it, expect } from 'vitest';
import { Account } from '../../../src/developer-tools/auth/Account.ts';

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
});
