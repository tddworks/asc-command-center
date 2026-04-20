import { describe, it, expect, vi } from 'vitest';
import { App } from '../../src/app/App.ts';
import { Apps } from '../../src/app/Apps.ts';
import type { AppRepository } from '../../src/app/AppRepository.ts';

function stubRepo(overrides: Partial<AppRepository> = {}): AppRepository {
  return {
    list: vi.fn(),
    get: vi.fn(),
    builds: vi.fn(),
    versions: vi.fn(),
    ...overrides,
  };
}

const weatherApp = new App('a-1', 'WeatherApp', 'com.example.weather', 'SKU001', 'en-US', true, {});
const fitnessApp = new App('a-2', 'FitnessTracker', 'com.example.fitness', 'SKU002', 'en-US', true, {});

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
