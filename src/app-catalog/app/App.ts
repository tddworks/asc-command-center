import { makeAutoObservable, runInAction } from 'mobx';
import type { Affordances } from '../../shared/types.ts';
import type { AppRepository } from './AppRepository.ts';
import type { Build } from '../../release/build/Build.ts';
import { Version } from '../../release/version/Version.ts';

export interface AppInit {
  id: string;
  name: string;
  bundleId: string;
  sku: string;
  primaryLocale: string;
  isAvailableInNewTerritories: boolean;
  affordances: Affordances;
  contentRightsDeclaration?: string;
  /** Already-resolved icon URL (http, data:, etc.). Takes precedence. */
  iconUrl?: string;
  /** ASC ImageAsset template URL — contains `{w}x{h}` and `{f}` placeholders. */
  iconTemplateUrl?: string;
}

/**
 * App — aggregate root of the App Catalog context.
 *
 * Mutable observable (MobX) class mirroring the Swift SDK's `@Observable class App`.
 * Navigation methods (loadVersions, selectVersion) mutate in place; components
 * wrapped in `observer()` re-render on field change.
 */
export class App {
  readonly id: string;
  name: string;
  bundleId: string;
  sku: string;
  primaryLocale: string;
  isAvailableInNewTerritories: boolean;
  affordances: Affordances;
  contentRightsDeclaration?: string;
  iconUrl?: string;
  iconTemplateUrl?: string;

  /** Versions loaded for this app (populated by loadVersions()). */
  versions: Version[] = [];

  /** The version the user is currently focused on (sidebar pin, etc.). */
  selectedVersion: Version | null = null;

  repository: AppRepository | null;

  constructor(init: AppInit, repository: AppRepository | null = null) {
    this.id = init.id;
    this.name = init.name;
    this.bundleId = init.bundleId;
    this.sku = init.sku;
    this.primaryLocale = init.primaryLocale;
    this.isAvailableInNewTerritories = init.isAvailableInNewTerritories;
    this.affordances = init.affordances;
    this.contentRightsDeclaration = init.contentRightsDeclaration;
    this.iconUrl = init.iconUrl;
    this.iconTemplateUrl = init.iconTemplateUrl;
    this.repository = repository;

    makeAutoObservable(this, { id: false, repository: false });
  }

  // ── Semantic Booleans ──

  get hasContentRights(): boolean {
    return this.contentRightsDeclaration !== undefined;
  }

  get canEdit(): boolean {
    return !!this.selectedVersion?.isEditable || !!this.selectedVersion?.isRejected;
  }

  // ── Capability Checks — from server affordances ──

  get canViewVersions(): boolean {
    return 'getVersions' in this.affordances;
  }

  get canViewBuilds(): boolean {
    return 'getBuilds' in this.affordances;
  }

  // ── Display ──

  get displayName(): string {
    return `${this.name} (${this.bundleId})`;
  }

  get statusLabel(): string {
    return this.selectedVersion?.statusLabel ?? '—';
  }

  get statusTone(): 'success' | 'info' | 'warning' | 'danger' | 'neutral' {
    return this.selectedVersion?.statusTone ?? 'neutral';
  }

  /**
   * Resolve the icon URL for a desired pixel size. Prefers a direct `iconUrl`,
   * falls back to the Apple ImageAsset template URL with `{w}`/`{h}`/`{f}`
   * placeholders substituted. Returns `null` when no icon source is known —
   * the UI should render the first-letter fallback.
   */
  iconSrc(size = 64): string | null {
    if (this.iconUrl) return this.iconUrl;
    if (this.iconTemplateUrl) {
      return this.iconTemplateUrl
        .replace(/\{w\}/g, String(size))
        .replace(/\{h\}/g, String(size))
        .replace(/\{f\}/g, 'png');
    }
    return null;
  }

  // ── Navigation (mutating) ──

  async loadBuilds(): Promise<Build[]> {
    if (!this.canViewBuilds) return [];
    return this.requireRepo().builds(this);
  }

  /**
   * Load this app's versions and populate `versions`. Picks a default
   * `selectedVersion` if none is set (first editable → first → null).
   */
  async loadVersions(): Promise<Version[]> {
    if (!this.canViewVersions) {
      runInAction(() => { this.versions = []; });
      return [];
    }
    const list = await this.requireRepo().versions(this);
    runInAction(() => {
      this.versions = list;
      if (!this.selectedVersion || !list.some((v) => v.id === this.selectedVersion!.id)) {
        this.selectedVersion = this.defaultVersion();
      }
    });
    return list;
  }

  /** Pin a different version as current. Throws if id is not in `versions`. */
  selectVersion(id: string): void {
    const found = this.versions.find((v) => v.id === id);
    if (!found) {
      throw new Error(`Version ${id} is not loaded on app ${this.id}`);
    }
    this.selectedVersion = found;
  }

  setRepository(repo: AppRepository): void {
    this.repository = repo;
  }

  private defaultVersion(): Version | null {
    return this.versions.find((v) => v.isEditable) ?? this.versions[0] ?? null;
  }

  private requireRepo(): AppRepository {
    if (!this.repository) {
      throw new Error(
        `App ${this.id} has no repository attached — construct via AppRepository or call setRepository().`,
      );
    }
    return this.repository;
  }

  // ── Factory ──

  static fromJSON(json: Record<string, unknown>, repo?: AppRepository): App {
    // Icon sources may arrive as a flat iconUrl, an ASC-shaped
    // iconAssetToken: { templateUrl }, or the ascii shorthand `icon`.
    const iconAsset =
      (json.iconAssetToken as { templateUrl?: string } | undefined) ??
      (json.icon as { templateUrl?: string } | undefined);

    return new App(
      {
        id: json.id as string,
        name: (json.name as string) ?? '',
        bundleId: (json.bundleId as string) ?? '',
        sku: (json.sku as string) ?? '',
        primaryLocale: (json.primaryLocale as string) ?? 'en-US',
        isAvailableInNewTerritories: (json.isAvailableInNewTerritories as boolean) ?? true,
        affordances: (json.affordances as Affordances) ?? {},
        contentRightsDeclaration: json.contentRightsDeclaration as string | undefined,
        iconUrl: json.iconUrl as string | undefined,
        iconTemplateUrl: iconAsset?.templateUrl,
      },
      repo ?? null,
    );
  }
}
