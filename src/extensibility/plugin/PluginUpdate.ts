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
