import { makeAutoObservable, runInAction } from 'mobx';
import type { Affordances } from '../../shared/types.ts';
import type { VersionRepository } from './VersionRepository.ts';
import { VersionLocalization } from './VersionLocalization.ts';

export enum VersionState {
  ReadyForSale = 'READY_FOR_SALE',
  PrepareForSubmission = 'PREPARE_FOR_SUBMISSION',
  WaitingForReview = 'WAITING_FOR_REVIEW',
  InReview = 'IN_REVIEW',
  Rejected = 'REJECTED',
  DeveloperRejected = 'DEVELOPER_REJECTED',
  PendingDeveloperRelease = 'PENDING_DEVELOPER_RELEASE',
}

/** Apple `Platform` values. Strings match the backend payload exactly so
 *  they flow through `Version.fromJSON` without translation. */
export enum Platform {
  iOS = 'IOS',
  macOS = 'MAC_OS',
  tvOS = 'TV_OS',
  visionOS = 'VISION_OS',
}

/** Init payload for `App.createVersion(...)`. Minimal — the backend fills in
 *  state (PREPARE_FOR_SUBMISSION) and identity; anything else the user wants
 *  to edit goes through `version.save()` after creation. */
export interface NewVersionInit {
  platform: Platform;
  versionString: string;
  copyright?: string | null;
}

export enum ReleaseType {
  Manual = 'MANUAL',
  AfterApproval = 'AFTER_APPROVAL',
  Scheduled = 'SCHEDULED',
}

export interface VersionInit {
  id: string;
  appId: string;
  versionString: string;
  state: VersionState;
  platform: string;
  affordances: Affordances;
  copyright?: string | null;
  releaseType?: ReleaseType;
  earliestReleaseDate?: string | null;
}

/**
 * Version — aggregate for one App Store version. Mutable observable (MobX),
 * mirroring the App/AppInfo pattern. Read-only identity (`id`, `appId`,
 * `platform`); editable attributes; an array of `VersionLocalization`
 * children for per-locale text.
 */
export class Version {
  readonly id: string;
  readonly appId: string;
  readonly platform: string;

  versionString: string;
  state: VersionState;
  copyright: string | null;
  releaseType: ReleaseType;
  earliestReleaseDate: string | null;
  affordances: Affordances;

  /** Per-locale text (description, keywords, …). Populated by loadLocalizations(). */
  localizations: VersionLocalization[] = [];

  repository: VersionRepository | null = null;

  private snapshot: {
    versionString: string;
    copyright: string | null;
    releaseType: ReleaseType;
    earliestReleaseDate: string | null;
  };

  constructor(
    idOrInit: string | VersionInit,
    appId?: string,
    versionString?: string,
    state?: VersionState,
    platform?: string,
    affordances?: Affordances,
  ) {
    // Backward-compat: old positional constructor used by legacy call sites.
    const init: VersionInit = typeof idOrInit === 'string'
      ? {
          id: idOrInit,
          appId: appId ?? '',
          versionString: versionString ?? '',
          state: state ?? VersionState.PrepareForSubmission,
          platform: platform ?? 'IOS',
          affordances: affordances ?? {},
        }
      : idOrInit;

    this.id = init.id;
    this.appId = init.appId;
    this.platform = init.platform;
    this.versionString = init.versionString;
    this.state = init.state;
    this.affordances = init.affordances;
    this.copyright = init.copyright ?? null;
    this.releaseType = init.releaseType ?? ReleaseType.Manual;
    this.earliestReleaseDate = init.earliestReleaseDate ?? null;

    this.snapshot = this.capture();
    makeAutoObservable(this, {
      id: false, appId: false, platform: false, repository: false,
    });
  }

  // ── Semantic Booleans ──

  get isLive(): boolean {
    return this.state === VersionState.ReadyForSale;
  }

  get isEditable(): boolean {
    return this.state === VersionState.PrepareForSubmission;
  }

  get isPending(): boolean {
    return [VersionState.WaitingForReview, VersionState.InReview].includes(this.state);
  }

  get isRejected(): boolean {
    return this.state === VersionState.Rejected;
  }

  // ── Display (pure mapping over state) ──

  get statusLabel(): string {
    switch (this.state) {
      case VersionState.ReadyForSale: return 'Live';
      case VersionState.PrepareForSubmission: return 'Preparing';
      case VersionState.WaitingForReview: return 'Waiting for Review';
      case VersionState.InReview: return 'In Review';
      case VersionState.Rejected: return 'Rejected';
      case VersionState.DeveloperRejected: return 'Developer Rejected';
      case VersionState.PendingDeveloperRelease: return 'Pending Release';
    }
  }

  get statusTone(): 'success' | 'info' | 'warning' | 'danger' | 'neutral' {
    switch (this.state) {
      case VersionState.ReadyForSale: return 'success';
      case VersionState.PrepareForSubmission: return 'info';
      case VersionState.PendingDeveloperRelease: return 'info';
      case VersionState.WaitingForReview: return 'warning';
      case VersionState.InReview: return 'warning';
      case VersionState.Rejected: return 'danger';
      case VersionState.DeveloperRejected: return 'danger';
    }
  }

  // ── Capability Checks — derived from server affordances ──

  get canSubmit(): boolean {
    return 'submitForReview' in this.affordances;
  }

  get canRelease(): boolean {
    return 'releaseVersion' in this.affordances;
  }

  get canEdit(): boolean {
    return 'updateVersion' in this.affordances;
  }

  // ── Setters ──

  setVersionString(v: string): void { this.versionString = v; }
  setCopyright(v: string | null): void { this.copyright = v; }
  setReleaseType(v: ReleaseType): void { this.releaseType = v; }
  setEarliestReleaseDate(v: string | null): void { this.earliestReleaseDate = v; }
  setRepository(repo: VersionRepository): void { this.repository = repo; }

  // ── Dirty tracking ──

  get hasUnsavedChanges(): boolean {
    const s = this.snapshot;
    if (
      this.versionString !== s.versionString ||
      this.copyright !== s.copyright ||
      this.releaseType !== s.releaseType ||
      this.earliestReleaseDate !== s.earliestReleaseDate
    ) return true;
    return this.localizations.some((l) => l.hasUnsavedChanges);
  }

  discard(): void {
    const s = this.snapshot;
    this.versionString = s.versionString;
    this.copyright = s.copyright;
    this.releaseType = s.releaseType;
    this.earliestReleaseDate = s.earliestReleaseDate;
    for (const loc of this.localizations) loc.discard();
  }

  markSaved(): void {
    this.snapshot = this.capture();
    for (const loc of this.localizations) loc.markSaved();
  }

  private capture() {
    return {
      versionString: this.versionString,
      copyright: this.copyright,
      releaseType: this.releaseType,
      earliestReleaseDate: this.earliestReleaseDate,
    };
  }

  // ── Navigation (mutating) ──

  /** Load per-locale text via the repository; populates `localizations`. */
  async loadLocalizations(): Promise<VersionLocalization[]> {
    if (!this.repository) {
      throw new Error(`Version ${this.id} has no repository attached`);
    }
    const list = await this.repository.listLocalizations(this);
    runInAction(() => {
      this.localizations = list;
    });
    return list;
  }

  async save(): Promise<void> {
    if (!this.repository) {
      throw new Error(`Version ${this.id} has no repository attached`);
    }
    await this.repository.save(this);
    runInAction(() => this.markSaved());
  }

  localizationFor(locale: string): VersionLocalization | undefined {
    return this.localizations.find((l) => l.locale === locale);
  }

  // ── Domain Knowledge — state machine ──

  canTransitionTo(target: VersionState): boolean {
    const transitions: Partial<Record<VersionState, VersionState[]>> = {
      [VersionState.PrepareForSubmission]: [VersionState.WaitingForReview],
      [VersionState.Rejected]: [VersionState.PrepareForSubmission],
      [VersionState.PendingDeveloperRelease]: [VersionState.ReadyForSale],
    };
    return transitions[this.state]?.includes(target) ?? false;
  }

  // ── Factory ──

  static fromJSON(json: Record<string, unknown>): Version {
    return new Version({
      id: json.id as string,
      appId: (json.appId as string) ?? '',
      versionString: (json.versionString as string) ?? '',
      state: json.state as VersionState,
      platform: (json.platform as string) ?? 'IOS',
      affordances: (json.affordances as Affordances) ?? {},
      copyright: (json.copyright as string | null) ?? null,
      releaseType: (json.releaseType as ReleaseType) ?? ReleaseType.Manual,
      earliestReleaseDate: (json.earliestReleaseDate as string | null) ?? null,
    });
  }
}
