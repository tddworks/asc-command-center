import { describe, it, expect, vi } from 'vitest';
import { AppInfo } from '../../../src/app-catalog/app-info/AppInfo.ts';
import { AppInfoLocalization } from '../../../src/app-catalog/app-info/AppInfoLocalization.ts';
import { AppInfos } from '../../../src/app-catalog/app-info/AppInfos.ts';
import type { AppInfoRepository } from '../../../src/app-catalog/app-info/AppInfoRepository.ts';

function stubRepo(overrides: Partial<AppInfoRepository> = {}): AppInfoRepository {
  return {
    list: vi.fn(),
    saveCategories: vi.fn().mockResolvedValue(undefined),
    saveLocalization: vi.fn().mockResolvedValue(undefined),
    createLocalization: vi.fn().mockResolvedValue({ id: 'new-id', affordances: {} }),
    deleteLocalization: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

const fixture = new AppInfo({
  id: 'info-1', appId: 'app-1',
  primaryCategoryId: 'FOOD_AND_DRINK', secondaryCategoryId: null,
  primaryLocale: 'en-US',
  localizations: [
    new AppInfoLocalization({ id: 'loc-1', locale: 'en-US', name: 'Bakery', subtitle: null }),
  ],
});

describe('AppInfos (root aggregate)', () => {

  it('list delegates to the repository', async () => {
    const repo = stubRepo({ list: vi.fn().mockResolvedValue([fixture]) });
    const roots = new AppInfos(repo);

    await expect(roots.list('app-1')).resolves.toEqual([fixture]);
    expect(repo.list).toHaveBeenCalledWith('app-1', undefined);
  });

  it('propagates repository errors', async () => {
    const repo = stubRepo({ list: vi.fn().mockRejectedValue(new Error('boom')) });
    const roots = new AppInfos(repo);

    await expect(roots.list('app-1')).rejects.toThrow('boom');
  });
});
