import { App } from '../App.ts';
import { Build } from '../../../release/build/Build.ts';
import { Version, type NewVersionInit } from '../../../release/version/Version.ts';
import type { AppRepository } from '../AppRepository.ts';
import { mockBuilds } from '../../../release/build/infrastructure/Build.mock.ts';
import {
  mockVersionsWithRepo,
  mockAppendVersion,
} from '../../../release/version/infrastructure/Version.mock.ts';
import { MockVersionRepository } from '../../../release/version/infrastructure/VersionRepository.mock.ts';
import { MockAppInfoRepository } from '../../app-info/infrastructure/AppInfo.mock.ts';
import type { AppInfo } from '../../app-info/AppInfo.ts';

/**
 * Generate an SVG data URI that stands in for a real app icon in mock mode.
 * Produces a rounded square with a gradient and a large glyph — enough to
 * make each mock app visually distinct without shipping binary assets.
 */
function svgIcon(glyph: string, from: string, to: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${from}"/>
        <stop offset="100%" stop-color="${to}"/>
      </linearGradient>
    </defs>
    <rect width="128" height="128" rx="28" fill="url(#g)"/>
    <text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle"
          font-family="-apple-system, 'Segoe UI Emoji', 'Apple Color Emoji', sans-serif"
          font-size="72" fill="#fff">${glyph}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export class MockAppRepository implements AppRepository {
  /** Shared across every call into this mock so a Version created in one
   *  interaction shows up in the next `versions()` list. */
  private readonly versionRepo = new MockVersionRepository();
  /** Single AppInfo mock so state mutations persist across list calls. */
  private readonly appInfoRepo = new MockAppInfoRepository();

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
    return mockVersionsWithRepo(app.id, this.versionRepo);
  }

  async createVersion(app: App, init: NewVersionInit): Promise<Version> {
    return mockAppendVersion(app.id, init, this.versionRepo);
  }

  async appInfos(app: App): Promise<AppInfo[]> {
    return this.appInfoRepo.list(app.id, { primaryLocale: app.primaryLocale });
  }

  async updateContentRights(_app: App): Promise<void> {
    // Mock mode: the value is already set on the in-memory App; nothing
    // else to persist.
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
            createVersion: '/api/v1/apps/app-1/versions',
          },
          iconUrl: svgIcon('⛅', '#60A5FA', '#2563EB'),
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
            createVersion: '/api/v1/apps/app-2/versions',
          },
          contentRightsDeclaration: 'USES_THIRD_PARTY_CONTENT',
          iconUrl: svgIcon('🏋️', '#34D399', '#059669'),
        },
        this,
      ),
    ];
  }
}
