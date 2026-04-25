import { makeAutoObservable } from 'mobx';
import type { Affordances } from '../../shared/types.ts';

export interface PluginUpdateInit {
  /** The installed plugin's name — matches the `name` field on the
   *  installed-list entries (and the `:name` segment in the update URL). */
  name: string;
  installedVersion: string;
  latestVersion: string;
  affordances?: Affordances;
}

/**
 * PluginUpdate — one row from `GET /api/v1/plugins/updates`.
 *
 * Sparkle-style appcast: a thin pairing of "what's installed" with
 * "what's the latest in the marketplace". The aggregate looks these up
 * by `name` to decide which Installed cards should render an Update CTA.
 *
 * Read-only — applying the update goes through the aggregate / repository.
 */
export class PluginUpdate {
  readonly name: string;
  readonly installedVersion: string;
  readonly latestVersion: string;
  readonly affordances: Affordances;

  constructor(init: PluginUpdateInit) {
    this.name = init.name;
    this.installedVersion = init.installedVersion;
    this.latestVersion = init.latestVersion;
    this.affordances = init.affordances ?? {};
    makeAutoObservable(this, {
      name: false, installedVersion: false, latestVersion: false, affordances: false,
    });
  }

  // ── Display ──

  /** Compact "1.0.0 → 1.2.0" label for the per-card badge. */
  get versionDelta(): string {
    return `${this.installedVersion} → ${this.latestVersion}`;
  }

  /** True when `latestVersion` is strictly newer than `installedVersion`.
   *  The asc backend's `listOutdated` emits any version mismatch — so a
   *  locally-newer plugin would otherwise be flagged as "needs update"
   *  with the delta reading downhill. The page hides updates where
   *  `isUpgrade` is false. */
  get isUpgrade(): boolean {
    return compareVersions(this.latestVersion, this.installedVersion) > 0;
  }

  /** REST URL the backend exposes for applying this update; falls back
   *  to the canonical `POST /api/v1/plugins/:name/update` when the
   *  affordance isn't shipped. */
  get updateUrl(): string | null {
    return this.affordances.update ?? null;
  }

  // ── Factory ──

  static fromJSON(json: Record<string, unknown>): PluginUpdate {
    return new PluginUpdate({
      name: (json.name as string) ?? '',
      installedVersion: (json.installedVersion as string) ?? '',
      latestVersion: (json.latestVersion as string) ?? '',
      affordances: (json.affordances as Affordances | undefined) ?? {},
    });
  }
}

/** Loose semver compare: positive when `a` > `b`, negative when `a` < `b`,
 *  zero when equal. Pads the shorter list with zeros (`1.0` < `1.0.1`),
 *  treats non-numeric segments as zero (good enough for the asc CLI's
 *  plugin versions; not meant to handle pre-release tags). */
function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((s) => parseInt(s, 10) || 0);
  const pb = b.split('.').map((s) => parseInt(s, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}
