import { AppInfo } from '../AppInfo.ts';
import { AppInfoLocalization } from '../AppInfoLocalization.ts';
import type { AppInfoRepository } from '../AppInfoRepository.ts';

/**
 * In-memory AppInfo store. Seeds deterministic fixtures for known mock apps
 * and lazily seeds any app id that hasn't been touched yet, so switching
 * apps in the sidebar always works in both mock mode and REST fallback.
 *
 * `save()` simulates persistence by cloning the current aggregate into the
 * store and calling `markSaved()` on the aggregate instance. Locally-added
 * localizations get deterministic backend ids.
 */
export class MockAppInfoRepository implements AppInfoRepository {
  private store: Map<string, Snapshot> = new Map();
  private idSeed = 1000;

  async get(appId: string): Promise<AppInfo> {
    if (!this.store.has(appId)) this.store.set(appId, seedFor(appId));
    return hydrate(appId, this.store.get(appId)!, this);
  }

  async save(appInfo: AppInfo): Promise<void> {
    // Simulate backend assigning ids to locally-added locales.
    for (const loc of appInfo.localizations) {
      if (loc.id === '') {
        loc.markSaved(`mock-loc-${this.idSeed++}`);
      } else {
        loc.markSaved();
      }
    }
    this.store.set(appInfo.appId, serialize(appInfo));
  }
}

// ── internals ──

interface Snapshot {
  id: string;
  primaryCategoryId: string | null;
  secondaryCategoryId: string | null;
  privacyPolicyUrl: string | null;
  supportUrl: string | null;
  marketingUrl: string | null;
  primaryLocale: string;
  localizations: Array<{ id: string; locale: string; name: string; subtitle: string | null }>;
}

function serialize(info: AppInfo): Snapshot {
  return {
    id: info.id,
    primaryCategoryId: info.primaryCategoryId,
    secondaryCategoryId: info.secondaryCategoryId,
    privacyPolicyUrl: info.privacyPolicyUrl,
    supportUrl: info.supportUrl,
    marketingUrl: info.marketingUrl,
    primaryLocale: info.primaryLocale,
    localizations: info.localizations.map((l) => ({
      id: l.id,
      locale: l.locale,
      name: l.name,
      subtitle: l.subtitle,
    })),
  };
}

function hydrate(appId: string, s: Snapshot, repo: MockAppInfoRepository): AppInfo {
  const info = new AppInfo({
    id: s.id,
    appId,
    primaryCategoryId: s.primaryCategoryId,
    secondaryCategoryId: s.secondaryCategoryId,
    privacyPolicyUrl: s.privacyPolicyUrl,
    supportUrl: s.supportUrl,
    marketingUrl: s.marketingUrl,
    primaryLocale: s.primaryLocale,
    localizations: s.localizations.map((l) => new AppInfoLocalization(l)),
  });
  info.setRepository(repo);
  return info;
}

function seedFor(appId: string): Snapshot {
  if (appId === 'app-1') {
    return {
      id: 'info-app-1',
      primaryCategoryId: 'WEATHER',
      secondaryCategoryId: null,
      privacyPolicyUrl: 'https://example.com/weather/privacy',
      supportUrl: 'https://example.com/weather/support',
      marketingUrl: null,
      primaryLocale: 'en-US',
      localizations: [
        { id: 'loc-1-en', locale: 'en-US', name: 'WeatherApp', subtitle: 'Your daily weather' },
        { id: 'loc-1-de', locale: 'de-DE', name: 'WetterApp', subtitle: 'Ihr tägliches Wetter' },
      ],
    };
  }
  if (appId === 'app-2') {
    return {
      id: 'info-app-2',
      primaryCategoryId: 'HEALTH_AND_FITNESS',
      secondaryCategoryId: 'SPORTS',
      privacyPolicyUrl: 'https://example.com/fitness/privacy',
      supportUrl: 'https://example.com/fitness/support',
      marketingUrl: 'https://example.com/fitness',
      primaryLocale: 'en-US',
      localizations: [
        { id: 'loc-2-en', locale: 'en-US', name: 'FitnessTracker', subtitle: 'Move every day' },
      ],
    };
  }
  // Fallback for any other app id (e.g., real REST app we fell back to mock for).
  return {
    id: `info-${appId}`,
    primaryCategoryId: null,
    secondaryCategoryId: null,
    privacyPolicyUrl: null,
    supportUrl: null,
    marketingUrl: null,
    primaryLocale: 'en-US',
    localizations: [
      { id: `loc-${appId}-en`, locale: 'en-US', name: '', subtitle: null },
    ],
  };
}
