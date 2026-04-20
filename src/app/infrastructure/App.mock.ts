import { App } from '../App.ts';
import { Build } from '../../build/Build.ts';
import { Version } from '../../version/Version.ts';
import type { AppRepository } from '../AppRepository.ts';
import { mockBuilds } from '../../build/infrastructure/Build.mock.ts';
import { mockVersions } from '../../version/infrastructure/Version.mock.ts';

export class MockAppRepository implements AppRepository {
  async list(): Promise<App[]> {
    return this.fixtures();
  }

  async get(id: string): Promise<App> {
    const app = this.fixtures().find((a) => a.id === id);
    if (!app) throw new Error(`App ${id} not found`);
    return app;
  }

  async builds(app: App): Promise<Build[]> {
    return mockBuilds(app.id);
  }

  async versions(app: App): Promise<Version[]> {
    return mockVersions(app.id);
  }

  private fixtures(): App[] {
    return [
      new App(
        'app-1',
        'WeatherApp',
        'com.example.weather',
        'SKU001',
        'en-US',
        true,
        {
          getVersions: 'asc versions list --app-id app-1',
          getBuilds: 'asc builds list --app-id app-1',
          getReviews: 'asc reviews list --app-id app-1',
          getTestFlight: 'asc beta-groups list --app-id app-1',
        },
        undefined,
        this,
      ),
      new App(
        'app-2',
        'FitnessTracker',
        'com.example.fitness',
        'SKU002',
        'en-US',
        true,
        {
          getVersions: 'asc versions list --app-id app-2',
          getBuilds: 'asc builds list --app-id app-2',
        },
        'USES_THIRD_PARTY_CONTENT',
        this,
      ),
    ];
  }
}
