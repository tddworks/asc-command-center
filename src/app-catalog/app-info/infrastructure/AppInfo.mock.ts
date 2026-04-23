import { AppInfo } from '../AppInfo.ts';
import { AppInfoLocalization } from '../AppInfoLocalization.ts';
import type { AppInfoListHints, AppInfoRepository } from '../AppInfoRepository.ts';

/**
 * In-memory AppInfo store. Seeds deterministic fixtures for known mock apps
 * and lazily seeds any app id that hasn't been touched yet, so switching
 * apps in the sidebar always works in both mock mode and REST fallback.
 *
 * Implements the repository port's granular methods — each one touches the
 * store for the slice of state it owns, just like the REST adapter PATCHes
 * the matching resource.
 */
export class MockAppInfoRepository implements AppInfoRepository {
  private store: Map<string, Snapshot> = new Map();
  private idSeed = 1000;

  async list(appId: string, _hints?: AppInfoListHints): Promise<AppInfo[]> {
    if (!this.store.has(appId)) this.store.set(appId, seedFor(appId));
    return [hydrate(appId, this.store.get(appId)!, this)];
  }

  async saveCategories(appInfo: AppInfo): Promise<void> {
    const snap = this.store.get(appInfo.appId);
    if (!snap) return;
    snap.primaryCategoryId = appInfo.primaryCategoryId;
    snap.secondaryCategoryId = appInfo.secondaryCategoryId;
    snap.contentRightsDeclaration = appInfo.contentRightsDeclaration;
  }

  async saveLocalization(loc: AppInfoLocalization): Promise<void> {
    const snap = this.findSnapshotFor(loc);
    if (!snap) return;
    const row = snap.localizations.find((l) => l.id === loc.id);
    if (!row) return;
    row.name = loc.name;
    row.subtitle = loc.subtitle;
    row.privacyPolicyUrl = loc.privacyPolicyUrl;
    row.privacyChoicesUrl = loc.privacyChoicesUrl;
  }

  async createLocalization(
    appInfo: AppInfo,
    loc: AppInfoLocalization,
  ): Promise<{ id: string }> {
    const snap = this.store.get(appInfo.appId);
    if (!snap) throw new Error(`No mock AppInfo for app ${appInfo.appId}`);
    const id = `mock-loc-${this.idSeed++}`;
    snap.localizations.push({
      id,
      locale: loc.locale,
      name: loc.name,
      subtitle: loc.subtitle,
      privacyPolicyUrl: loc.privacyPolicyUrl,
      privacyChoicesUrl: loc.privacyChoicesUrl,
    });
    return { id };
  }

  async deleteLocalization(loc: AppInfoLocalization): Promise<void> {
    const snap = this.findSnapshotFor(loc);
    if (!snap) return;
    snap.localizations = snap.localizations.filter((l) => l.id !== loc.id);
  }

  // ── internals ──

  private findSnapshotFor(loc: AppInfoLocalization): Snapshot | undefined {
    for (const snap of this.store.values()) {
      if (snap.localizations.some((l) => l.id === loc.id)) return snap;
    }
    return undefined;
  }
}

// ── internals ──

interface LocalizationSnapshot {
  id: string;
  locale: string;
  name: string;
  subtitle: string | null;
  privacyPolicyUrl: string | null;
  privacyChoicesUrl: string | null;
}

interface Snapshot {
  id: string;
  primaryCategoryId: string | null;
  secondaryCategoryId: string | null;
  contentRightsDeclaration: string | null;
  primaryLocale: string;
  localizations: LocalizationSnapshot[];
}

function hydrate(appId: string, s: Snapshot, repo: MockAppInfoRepository): AppInfo {
  const info = new AppInfo({
    id: s.id,
    appId,
    primaryCategoryId: s.primaryCategoryId,
    secondaryCategoryId: s.secondaryCategoryId,
    contentRightsDeclaration: s.contentRightsDeclaration,
    primaryLocale: s.primaryLocale,
    localizations: s.localizations.map((l) => new AppInfoLocalization({
      id: l.id,
      locale: l.locale,
      name: l.name,
      subtitle: l.subtitle,
      privacyPolicyUrl: l.privacyPolicyUrl,
      privacyChoicesUrl: l.privacyChoicesUrl,
    })),
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
      contentRightsDeclaration: null,
      primaryLocale: 'en-US',
      localizations: [
        {
          id: 'loc-1-en', locale: 'en-US',
          name: 'WeatherApp', subtitle: 'Your daily weather',
          privacyPolicyUrl: 'https://example.com/weather/privacy',
          privacyChoicesUrl: null,
        },
        {
          id: 'loc-1-de', locale: 'de-DE',
          name: 'WetterApp', subtitle: 'Ihr tägliches Wetter',
          privacyPolicyUrl: null,
          privacyChoicesUrl: null,
        },
      ],
    };
  }
  if (appId === 'app-2') {
    return {
      id: 'info-app-2',
      primaryCategoryId: 'HEALTH_AND_FITNESS',
      secondaryCategoryId: 'SPORTS',
      contentRightsDeclaration: null,
      primaryLocale: 'en-US',
      localizations: [
        {
          id: 'loc-2-en', locale: 'en-US',
          name: 'FitnessTracker', subtitle: 'Move every day',
          privacyPolicyUrl: 'https://example.com/fitness/privacy',
          privacyChoicesUrl: null,
        },
      ],
    };
  }
  return {
    id: `info-${appId}`,
    primaryCategoryId: null,
    secondaryCategoryId: null,
    contentRightsDeclaration: null,
    primaryLocale: 'en-US',
    localizations: [
      {
        id: `loc-${appId}-en`, locale: 'en-US',
        name: '', subtitle: null,
        privacyPolicyUrl: null, privacyChoicesUrl: null,
      },
    ],
  };
}
