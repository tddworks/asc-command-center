import { describe, it, expect, vi } from 'vitest';
import { AppInfo } from '../../../src/app-catalog/app-info/AppInfo.ts';
import { AppInfoLocalization } from '../../../src/app-catalog/app-info/AppInfoLocalization.ts';
import { AppInfos } from '../../../src/app-catalog/app-info/AppInfos.ts';
import type { AppInfoRepository } from '../../../src/app-catalog/app-info/AppInfoRepository.ts';

function stubRepo(overrides: Partial<AppInfoRepository> = {}): AppInfoRepository {
  return {
    get: vi.fn(),
    save: vi.fn(),
    ...overrides,
  };
}

const fixture = new AppInfo({
  id: 'info-1', appId: 'app-1',
  primaryCategoryId: 'FOOD_AND_DRINK', secondaryCategoryId: null,
  privacyPolicyUrl: null, supportUrl: null, marketingUrl: null,
  primaryLocale: 'en-US',
  localizations: [
    new AppInfoLocalization({ id: 'loc-1', locale: 'en-US', name: 'Bakery', subtitle: null }),
  ],
});

describe('AppInfos (root aggregate)', () => {

  it('get delegates to the repository', async () => {
    const repo = stubRepo({ get: vi.fn().mockResolvedValue(fixture) });
    const roots = new AppInfos(repo);

    await expect(roots.get('app-1')).resolves.toBe(fixture);
    expect(repo.get).toHaveBeenCalledWith('app-1');
  });

  it('propagates repository errors', async () => {
    const repo = stubRepo({ get: vi.fn().mockRejectedValue(new Error('boom')) });
    const roots = new AppInfos(repo);

    await expect(roots.get('app-1')).rejects.toThrow('boom');
  });
});
