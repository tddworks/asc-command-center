import type { Affordances } from '../../shared/types.ts';

export enum VersionState {
  ReadyForSale = 'READY_FOR_SALE',
  PrepareForSubmission = 'PREPARE_FOR_SUBMISSION',
  WaitingForReview = 'WAITING_FOR_REVIEW',
  InReview = 'IN_REVIEW',
  Rejected = 'REJECTED',
  DeveloperRejected = 'DEVELOPER_REJECTED',
  PendingDeveloperRelease = 'PENDING_DEVELOPER_RELEASE',
}

export class Version {
  constructor(
    readonly id: string,
    readonly appId: string,
    readonly versionString: string,
    readonly state: VersionState,
    readonly platform: string,
    readonly affordances: Affordances,
  ) {}

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
    return new Version(
      json.id as string,
      (json.appId as string) ?? '',
      (json.versionString as string) ?? '',
      json.state as VersionState,
      (json.platform as string) ?? 'IOS',
      (json.affordances as Affordances) ?? {},
    );
  }
}
