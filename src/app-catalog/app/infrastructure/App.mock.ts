import { App } from '../App.ts';
import { Build } from '../../../release/build/Build.ts';
import { Version } from '../../../release/version/Version.ts';
import type { AppRepository } from '../AppRepository.ts';
import { mockBuilds } from '../../../release/build/infrastructure/Build.mock.ts';
import { mockVersions } from '../../../release/version/infrastructure/Version.mock.ts';

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
        {
          id: 'app-1',
          name: 'WeatherApp',
          bundleId: 'com.example.weather',
          sku: 'SKU001',
          primaryLocale: 'en-US',
          isAvailableInNewTerritories: true,
          affordances: {
            getVersions: '/api/v1/apps/app-1/versions',
            getBuilds: '/api/v1/apps/app-1/builds',
            getReviews: '/api/v1/apps/app-1/reviews',
            getTestFlight: '/api/v1/apps/app-1/beta-groups',
          },
        },
        this,
      ),
      new App(
        {
          id: 'app-2',
          name: 'FitnessTracker',
          bundleId: 'com.example.fitness',
          sku: 'SKU002',
          primaryLocale: 'en-US',
          isAvailableInNewTerritories: true,
          affordances: {
            getVersions: '/api/v1/apps/app-2/versions',
            getBuilds: '/api/v1/apps/app-2/builds',
          },
          contentRightsDeclaration: 'USES_THIRD_PARTY_CONTENT',
        },
        this,
      ),
    ];
  }
}
