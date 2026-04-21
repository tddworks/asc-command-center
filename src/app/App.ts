import { makeAutoObservable, runInAction } from 'mobx';
import type { Affordances } from '../shared/types.ts';
import type { AppRepository } from './AppRepository.ts';
import type { Build } from '../build/Build.ts';
import { Version } from '../version/Version.ts';

export interface AppInit {
  id: string;
  name: string;
  bundleId: string;
  sku: string;
  primaryLocale: string;
  isAvailableInNewTerritories: boolean;
  affordances: Affordances;
  contentRightsDeclaration?: string;
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
      },
      repo ?? null,
    );
  }
}
