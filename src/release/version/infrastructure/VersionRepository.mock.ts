import { Version } from '../Version.ts';
import { VersionLocalization } from '../VersionLocalization.ts';
import type { VersionRepository } from '../VersionRepository.ts';

/**
 * In-memory VersionRepository for mock mode and REST fallback. Seeds
 * deterministic per-locale text for the known mock versions and lazily
 * seeds unknown ones so switching versions always has editable fields.
 */
export class MockVersionRepository implements VersionRepository {
  private localizationStore: Map<string, VersionLocalizationSnapshot[]> = new Map();
  private idSeed = 5000;

  async listLocalizations(version: Version): Promise<VersionLocalization[]> {
    if (!this.localizationStore.has(version.id)) {
      this.localizationStore.set(version.id, seedLocalizations(version));
    }
    const snaps = this.localizationStore.get(version.id)!;
    return snaps.map((s) => new VersionLocalization({ ...s }));
  }

  async save(version: Version): Promise<void> {
    // Simulate backfill of backend ids on locally-added localizations.
    for (const loc of version.localizations) {
      if (loc.id === '') loc.markSaved(`mock-vloc-${this.idSeed++}`);
      else loc.markSaved();
    }
    this.localizationStore.set(
      version.id,
      version.localizations.map(serializeLocalization),
    );
  }
}

// ── internals ──────────────────────────────────────────────────────

interface VersionLocalizationSnapshot {
  id: string;
  locale: string;
  description: string;
  keywords: string;
  whatsNew: string;
  promotionalText: string;
  supportUrl: string | null;
  marketingUrl: string | null;
}

function serializeLocalization(l: VersionLocalization): VersionLocalizationSnapshot {
  return {
    id: l.id,
    locale: l.locale,
    description: l.description,
    keywords: l.keywords,
    whatsNew: l.whatsNew,
    promotionalText: l.promotionalText,
    supportUrl: l.supportUrl,
    marketingUrl: l.marketingUrl,
  };
}

function seedLocalizations(version: Version): VersionLocalizationSnapshot[] {
  // v-1 and v-2 get richer fixtures; everything else gets an empty en-US row.
  if (version.id === 'v-1') {
    return [
      {
        id: 'vloc-1-en',
        locale: 'en-US',
        description:
          'Track unlimited subscriptions. Pause, cancel, or reactivate with one tap. See spending by category and spot the renewals that aren\'t worth it.',
        keywords: 'subscription,tracker,renewal,calendar,spending,budget',
        whatsNew: 'Faster sync. New monthly breakdown chart. Bug fixes.',
        promotionalText: 'Limited time offer — 30 days of Pro free.',
        supportUrl: 'https://example.com/support',
        marketingUrl: 'https://example.com/',
      },
    ];
  }
  return [
    {
      id: `vloc-${version.id}-en`,
      locale: 'en-US',
      description: '',
      keywords: '',
      whatsNew: '',
      promotionalText: '',
      supportUrl: null,
      marketingUrl: null,
    },
  ];
}
