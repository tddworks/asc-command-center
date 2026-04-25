import { describe, it, expect, vi } from 'vitest';
import { App } from '../../../src/app-catalog/app/App.ts';
import { Apps } from '../../../src/app-catalog/app/Apps.ts';
import type { AppRepository } from '../../../src/app-catalog/app/AppRepository.ts';

function stubRepo(overrides: Partial<AppRepository> = {}): AppRepository {
  return {
    list: vi.fn(),
    get: vi.fn(),
    builds: vi.fn(),
    versions: vi.fn(),
    createVersion: vi.fn(),
    appInfos: vi.fn().mockResolvedValue([]),
    updateContentRights: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

const weatherApp = new App({
  id: 'a-1', name: 'WeatherApp', bundleId: 'com.example.weather',
  sku: 'SKU001', primaryLocale: 'en-US', isAvailableInNewTerritories: true, affordances: {},
});
const fitnessApp = new App({
  id: 'a-2', name: 'FitnessTracker', bundleId: 'com.example.fitness',
  sku: 'SKU002', primaryLocale: 'en-US', isAvailableInNewTerritories: true, affordances: {},
});

describe('Apps (root aggregate)', () => {

  it('list returns every App from the repository', async () => {
    const repo = stubRepo({ list: vi.fn().mockResolvedValue([weatherApp, fitnessApp]) });
    const apps = new Apps(repo);

    await expect(apps.list()).resolves.toEqual([weatherApp, fitnessApp]);
    expect(repo.list).toHaveBeenCalledOnce();
  });

  it('get fetches a single App by id', async () => {
    const repo = stubRepo({ get: vi.fn().mockResolvedValue(weatherApp) });
    const apps = new Apps(repo);

    await expect(apps.get('a-1')).resolves.toBe(weatherApp);
    expect(repo.get).toHaveBeenCalledWith('a-1');
  });

  it('surfaces repository errors from list', async () => {
    const repo = stubRepo({ list: vi.fn().mockRejectedValue(new Error('boom')) });
    const apps = new Apps(repo);

    await expect(apps.list()).rejects.toThrow('boom');
  });
});
