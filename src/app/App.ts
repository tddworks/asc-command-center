import type { Affordances } from '../shared/types.ts';
import type { AppRepository } from './AppRepository.ts';
import type { Build } from '../build/Build.ts';
import type { Version } from '../version/Version.ts';

export class App {
  constructor(
    readonly id: string,
    readonly name: string,
    readonly bundleId: string,
    readonly sku: string,
    readonly primaryLocale: string,
    readonly isAvailableInNewTerritories: boolean,
    readonly affordances: Affordances,
    readonly contentRightsDeclaration?: string,
    private readonly repo?: AppRepository,
  ) {}

  // ── Semantic Booleans ──

  get hasContentRights(): boolean {
    return this.contentRightsDeclaration !== undefined;
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

  // ── Navigation (rich domain) ──

  async loadBuilds(): Promise<Build[]> {
    if (!this.canViewBuilds) return [];
    return this.requireRepo().builds(this);
  }

  async loadVersions(): Promise<Version[]> {
    if (!this.canViewVersions) return [];
    return this.requireRepo().versions(this);
  }

  /** Attach a repository to an existing value-object App (returns a new instance). */
  withRepository(repo: AppRepository): App {
    return new App(
      this.id,
      this.name,
      this.bundleId,
      this.sku,
      this.primaryLocale,
      this.isAvailableInNewTerritories,
      this.affordances,
      this.contentRightsDeclaration,
      repo,
    );
  }

  private requireRepo(): AppRepository {
    if (!this.repo) {
      throw new Error(`App ${this.id} has no repository attached — construct via AppRepository or call withRepository().`);
    }
    return this.repo;
  }

  // ── Factory ──

  static fromJSON(json: Record<string, unknown>, repo?: AppRepository): App {
    return new App(
      json.id as string,
      (json.name as string) ?? '',
      (json.bundleId as string) ?? '',
      (json.sku as string) ?? '',
      (json.primaryLocale as string) ?? 'en-US',
      (json.isAvailableInNewTerritories as boolean) ?? true,
      (json.affordances as Affordances) ?? {},
      json.contentRightsDeclaration as string | undefined,
      repo,
    );
  }
}
