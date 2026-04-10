import { describe, it, expect } from 'vitest';
import { Certificate } from '../../src/code-signing/Certificate.ts';
import { BundleID } from '../../src/code-signing/BundleID.ts';
import { Profile } from '../../src/code-signing/Profile.ts';
import { Device } from '../../src/code-signing/Device.ts';

describe('Certificate', () => {

  it('is valid when status is VALID', () => {
    const c = new Certificate('cert-1', 'iOS Distribution', 'IOS_DISTRIBUTION', 'ABC123', '2025-12-01', 'VALID', {});
    expect(c.isValid).toBe(true);
    expect(c.isExpired).toBe(false);
  });

  it('is expired when status is EXPIRED', () => {
    const c = new Certificate('cert-2', 'iOS Development', 'IOS_DEVELOPMENT', 'DEF456', '2023-01-01', 'EXPIRED', {});
    expect(c.isExpired).toBe(true);
    expect(c.isValid).toBe(false);
  });

  it('can revoke when server provides affordance', () => {
    const c = new Certificate('cert-1', 'iOS Distribution', 'IOS_DISTRIBUTION', 'ABC123', '2025-12-01', 'VALID', {
      revoke: 'asc certificates revoke --certificate-id cert-1',
    });
    expect(c.canRevoke).toBe(true);
  });

  it('cannot revoke when affordance missing', () => {
    const c = new Certificate('cert-2', 'iOS Development', 'IOS_DEVELOPMENT', 'DEF456', '2023-01-01', 'REVOKED', {});
    expect(c.canRevoke).toBe(false);
  });

  it('hydrates from API JSON', () => {
    const json = {
      id: 'cert-1',
      name: 'iOS Distribution',
      certificateType: 'IOS_DISTRIBUTION',
      serialNumber: 'ABC123',
      expirationDate: '2025-12-01',
      status: 'VALID',
      affordances: { revoke: 'asc certificates revoke --certificate-id cert-1' },
    };
    const c = Certificate.fromJSON(json);
    expect(c.id).toBe('cert-1');
    expect(c.isValid).toBe(true);
    expect(c.canRevoke).toBe(true);
    expect(c.displayName).toBe('iOS Distribution (IOS_DISTRIBUTION)');
  });

  it('hydrates with empty affordances when missing', () => {
    const json = {
      id: 'cert-2', name: 'Dev', certificateType: 'IOS_DEVELOPMENT',
      serialNumber: 'XYZ', expirationDate: '2024-01-01', status: 'EXPIRED',
    };
    const c = Certificate.fromJSON(json);
    expect(c.affordances).toEqual({});
    expect(c.isExpired).toBe(true);
  });
});

describe('BundleID', () => {

  it('can delete when server provides affordance', () => {
    const b = new BundleID('bid-1', 'MyApp', 'com.example.myapp', 'IOS', 'SEED123', {
      delete: 'asc bundle-ids delete --bundle-id bid-1',
    });
    expect(b.canDelete).toBe(true);
  });

  it('cannot delete when affordance missing', () => {
    const b = new BundleID('bid-2', 'OtherApp', 'com.example.other', 'IOS', 'SEED456', {});
    expect(b.canDelete).toBe(false);
  });

  it('hydrates from API JSON', () => {
    const json = {
      id: 'bid-1',
      name: 'MyApp',
      identifier: 'com.example.myapp',
      platform: 'IOS',
      seedId: 'SEED123',
      affordances: { delete: 'asc bundle-ids delete --bundle-id bid-1' },
    };
    const b = BundleID.fromJSON(json);
    expect(b.id).toBe('bid-1');
    expect(b.identifier).toBe('com.example.myapp');
    expect(b.canDelete).toBe(true);
    expect(b.displayName).toBe('MyApp (com.example.myapp)');
  });
});

describe('Profile', () => {

  it('is active when profileState is ACTIVE', () => {
    const p = new Profile('prof-1', 'Dev Profile', 'IOS_APP_DEVELOPMENT', 'ACTIVE', '2025-06-01', {});
    expect(p.isActive).toBe(true);
  });

  it('is not active when profileState is INVALID', () => {
    const p = new Profile('prof-2', 'Old Profile', 'IOS_APP_STORE', 'INVALID', '2023-01-01', {});
    expect(p.isActive).toBe(false);
  });

  it('can delete when server provides affordance', () => {
    const p = new Profile('prof-1', 'Dev Profile', 'IOS_APP_DEVELOPMENT', 'ACTIVE', '2025-06-01', {
      delete: 'asc profiles delete --profile-id prof-1',
    });
    expect(p.canDelete).toBe(true);
  });

  it('hydrates from API JSON', () => {
    const json = {
      id: 'prof-1',
      name: 'Dev Profile',
      profileType: 'IOS_APP_DEVELOPMENT',
      profileState: 'ACTIVE',
      expirationDate: '2025-06-01',
      affordances: { delete: 'asc profiles delete --profile-id prof-1' },
    };
    const p = Profile.fromJSON(json);
    expect(p.id).toBe('prof-1');
    expect(p.isActive).toBe(true);
    expect(p.canDelete).toBe(true);
    expect(p.displayName).toBe('Dev Profile (IOS_APP_DEVELOPMENT)');
  });
});

describe('Device', () => {

  it('is enabled when status is ENABLED', () => {
    const d = new Device('dev-1', 'iPhone 15', 'UDID-001', 'IPHONE', 'iPhone15,2', 'ENABLED', {});
    expect(d.isEnabled).toBe(true);
  });

  it('is not enabled when status is DISABLED', () => {
    const d = new Device('dev-2', 'Old iPad', 'UDID-002', 'IPAD', 'iPad11,1', 'DISABLED', {});
    expect(d.isEnabled).toBe(false);
  });

  it('hydrates from API JSON', () => {
    const json = {
      id: 'dev-1',
      name: 'iPhone 15',
      udid: 'UDID-001',
      deviceClass: 'IPHONE',
      model: 'iPhone15,2',
      status: 'ENABLED',
      affordances: {},
    };
    const d = Device.fromJSON(json);
    expect(d.id).toBe('dev-1');
    expect(d.isEnabled).toBe(true);
    expect(d.displayName).toBe('iPhone 15 (iPhone15,2)');
  });

  it('hydrates with empty affordances when missing', () => {
    const json = {
      id: 'dev-2', name: 'iPad', udid: 'UDID-002',
      deviceClass: 'IPAD', model: 'iPad11,1', status: 'DISABLED',
    };
    const d = Device.fromJSON(json);
    expect(d.affordances).toEqual({});
    expect(d.isEnabled).toBe(false);
  });
});
