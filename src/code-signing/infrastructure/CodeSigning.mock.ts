import { Certificate } from '../Certificate.ts';
import { BundleID } from '../BundleID.ts';
import { Profile } from '../Profile.ts';
import { Device } from '../Device.ts';

export function mockCertificates(): Certificate[] {
  return [
    new Certificate('cert-1', 'iOS Distribution', 'IOS_DISTRIBUTION', 'ABC123', '2025-12-01', 'VALID', {
      revoke: 'asc certificates revoke --certificate-id cert-1',
    }),
    new Certificate('cert-2', 'iOS Development', 'IOS_DEVELOPMENT', 'DEF456', '2025-06-15', 'VALID', {
      revoke: 'asc certificates revoke --certificate-id cert-2',
    }),
    new Certificate('cert-3', 'Mac Distribution', 'MAC_APP_DISTRIBUTION', 'GHI789', '2023-01-01', 'EXPIRED', {}),
  ];
}

export function mockBundleIds(): BundleID[] {
  return [
    new BundleID('bid-1', 'MyApp', 'com.example.myapp', 'IOS', 'SEED123', {
      delete: 'asc bundle-ids delete --bundle-id bid-1',
    }),
    new BundleID('bid-2', 'MyApp macOS', 'com.example.myapp.macos', 'MAC_OS', 'SEED123', {
      delete: 'asc bundle-ids delete --bundle-id bid-2',
    }),
    new BundleID('bid-3', 'SharedKit', 'com.example.sharedkit', 'IOS', 'SEED456', {}),
  ];
}

export function mockProfiles(): Profile[] {
  return [
    new Profile('prof-1', 'MyApp Dev', 'IOS_APP_DEVELOPMENT', 'ACTIVE', '2025-06-01', {
      delete: 'asc profiles delete --profile-id prof-1',
    }),
    new Profile('prof-2', 'MyApp Store', 'IOS_APP_STORE', 'ACTIVE', '2025-12-01', {
      delete: 'asc profiles delete --profile-id prof-2',
    }),
    new Profile('prof-3', 'Old Profile', 'IOS_APP_ADHOC', 'INVALID', '2023-03-01', {}),
  ];
}

export function mockDevices(): Device[] {
  return [
    new Device('dev-1', 'iPhone 15 Pro', '00008110-AAAA-BBBB-CCCC', 'IPHONE', 'iPhone15,2', 'ENABLED', {}),
    new Device('dev-2', 'iPad Air', '00008110-DDDD-EEEE-FFFF', 'IPAD', 'iPad13,16', 'ENABLED', {}),
    new Device('dev-3', 'Old iPhone', '00008110-1111-2222-3333', 'IPHONE', 'iPhone12,1', 'DISABLED', {}),
  ];
}
