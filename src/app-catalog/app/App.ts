import { makeAutoObservable, runInAction } from 'mobx';
import type { Affordances } from '../../shared/types.ts';
import type { AppRepository } from './AppRepository.ts';
import type { Build } from '../../release/build/Build.ts';
import { Version, VersionState, type NewVersionInit, type Platform } from '../../release/version/Version.ts';
import type { AppInfo } from '../app-info/AppInfo.ts';

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

  /** AppInfo rows (one per version state — editable + live) populated by
   *  loadAppInfos(). The page-level UI reads the row that matches the
   *  selected version via `appInfoFor(state)`. */
  appInfos: AppInfo[] = [];

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
    // Backend ships `listVersions`; earlier fixtures used `getVersions`.
    return 'listVersions' in this.affordances || 'getVersions' in this.affordances;
  }

  get canViewBuilds(): boolean {
    return 'listBuilds' in this.affordances || 'getBuilds' in this.affordances;
  }

  get canCreateVersion(): boolean {
    return 'createVersion' in this.affordances;
  }

  /** Can the user open the Manage Versions sheet at all? True when there's
   *  either a create path (new version allowed) or at least one loaded
   *  version the backend says is editable — so update-only flows still work
   *  on backends that haven't shipped the `createVersion` affordance. */
  get canManageVersions(): boolean {
    if (this.canCreateVersion) return true;
    return this.versions.some((v) => v.canEdit);
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

  /**
   * Create a new AppStoreVersion under this app and push it into `versions`.
   * Gates on the `createVersion` capability — call sites should disable the
   * button when `canCreateVersion` is false, but we throw here too so a
   * programmer error surfaces immediately rather than silently no-op'ing.
   * The newly-created version becomes `selectedVersion` so the editor UI
   * opens on it without an extra click.
   */
  async createVersion(init: NewVersionInit): Promise<Version> {
    if (!this.canCreateVersion) {
      throw new Error(`App ${this.id} cannot createVersion — affordance missing`);
    }
    const created = await this.requireRepo().createVersion(this, init);
    runInAction(() => {
      this.versions = [...this.versions, created];
      this.selectedVersion = created;
    });
    return created;
  }

  /**
   * Find a loaded version on this app that is still editable for the given
   * platform. Used by the VersionManagementDialog to flip between create-mode
   * (no editable version → empty input) and update-mode (edit versionString
   * on the existing row). Matches the Swift SDK's `editableVersion` logic.
   */
  editableVersionForPlatform(platform: Platform | string): Version | null {
    return (
      this.versions.find((v) =>
        v.platform === platform &&
        (v.state === VersionState.PrepareForSubmission || v.state === VersionState.Rejected),
      ) ?? null
    );
  }

  /**
   * Load the AppInfo rows for this app. Mirrors `loadVersions`: gates on a
   * capability (here: "we can view versions", since AppInfos are scoped per
   * version state), hits the repository, mutates in place.
   */
  async loadAppInfos(): Promise<AppInfo[]> {
    if (!this.canViewVersions) {
      runInAction(() => { this.appInfos = []; });
      return [];
    }
    const list = await this.requireRepo().appInfos(this);
    runInAction(() => { this.appInfos = list; });
    return list;
  }

  /** Pick the AppInfo row whose `appStoreState` matches the given version
   *  state. Falls back to the first loaded row so the page always has a
   *  target when only one AppInfo is returned. */
  appInfoFor(versionState: string | null | undefined): AppInfo | null {
    if (!versionState) return this.appInfos[0] ?? null;
    return (
      this.appInfos.find((i) => i.appStoreState === versionState) ??
      this.appInfos[0] ??
      null
    );
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
    // Icon sources: `iconAsset` (our backend via ?include=icon),
    // `iconAssetToken` (ASC relationship shape), or `icon` shorthand.
    const iconAsset =
      (json.iconAsset as { templateUrl?: string } | undefined) ??
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
