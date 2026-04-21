import { describe, it, expect, vi } from 'vitest';
import { Version, VersionState, ReleaseType } from '../../../src/release/version/Version.ts';
import { VersionLocalization } from '../../../src/release/version/VersionLocalization.ts';

describe('Version', () => {

  // ── Semantic Booleans ──

  it('is live when state is READY_FOR_SALE', () => {
    const v = new Version('v-1', 'app-1', '2.0', VersionState.ReadyForSale, 'IOS', {});
    expect(v.isLive).toBe(true);
    expect(v.isEditable).toBe(false);
    expect(v.isPending).toBe(false);
    expect(v.isRejected).toBe(false);
  });

  it('is editable when state is PREPARE_FOR_SUBMISSION', () => {
    const v = new Version('v-1', 'app-1', '2.0', VersionState.PrepareForSubmission, 'IOS', {});
    expect(v.isEditable).toBe(true);
    expect(v.isLive).toBe(false);
  });

  it('is pending when waiting for review', () => {
    const v = new Version('v-1', 'app-1', '2.0', VersionState.WaitingForReview, 'IOS', {});
    expect(v.isPending).toBe(true);
  });

  it('is pending when in review', () => {
    const v = new Version('v-1', 'app-1', '2.0', VersionState.InReview, 'IOS', {});
    expect(v.isPending).toBe(true);
  });

  it('is rejected when state is REJECTED', () => {
    const v = new Version('v-1', 'app-1', '2.0', VersionState.Rejected, 'IOS', {});
    expect(v.isRejected).toBe(true);
  });

  // ── Capability Checks (from API affordances) ──

  it('can submit when server provides submitForReview affordance', () => {
    const v = new Version('v-1', 'app-1', '2.0', VersionState.PrepareForSubmission, 'IOS', {
      submitForReview: 'asc versions submit --id v-1',
    });
    expect(v.canSubmit).toBe(true);
  });

  it('cannot submit when server omits submitForReview affordance', () => {
    const v = new Version('v-1', 'app-1', '2.0', VersionState.PrepareForSubmission, 'IOS', {});
    expect(v.canSubmit).toBe(false);
  });

  it('can release when server provides releaseVersion affordance', () => {
    const v = new Version('v-1', 'app-1', '2.0', VersionState.PendingDeveloperRelease, 'IOS', {
      releaseVersion: 'asc versions release --id v-1',
    });
    expect(v.canRelease).toBe(true);
  });

  it('can edit when server provides updateVersion affordance', () => {
    const v = new Version('v-1', 'app-1', '2.0', VersionState.PrepareForSubmission, 'IOS', {
      updateVersion: 'asc versions update --id v-1',
    });
    expect(v.canEdit).toBe(true);
  });

  // ── State Transitions ──

  it('can transition from prepare to waiting for review', () => {
    const v = new Version('v-1', 'app-1', '2.0', VersionState.PrepareForSubmission, 'IOS', {});
    expect(v.canTransitionTo(VersionState.WaitingForReview)).toBe(true);
    expect(v.canTransitionTo(VersionState.ReadyForSale)).toBe(false);
  });

  it('can transition from rejected back to prepare', () => {
    const v = new Version('v-1', 'app-1', '2.0', VersionState.Rejected, 'IOS', {});
    expect(v.canTransitionTo(VersionState.PrepareForSubmission)).toBe(true);
  });

  it('can transition from pending release to ready for sale', () => {
    const v = new Version('v-1', 'app-1', '2.0', VersionState.PendingDeveloperRelease, 'IOS', {});
    expect(v.canTransitionTo(VersionState.ReadyForSale)).toBe(true);
  });

  it('live version cannot transition anywhere', () => {
    const v = new Version('v-1', 'app-1', '2.0', VersionState.ReadyForSale, 'IOS', {});
    expect(v.canTransitionTo(VersionState.PrepareForSubmission)).toBe(false);
    expect(v.canTransitionTo(VersionState.WaitingForReview)).toBe(false);
  });

  // ── Display (statusLabel + statusTone) ──

  it.each([
    [VersionState.ReadyForSale, 'Live', 'success'],
    [VersionState.PrepareForSubmission, 'Preparing', 'info'],
    [VersionState.WaitingForReview, 'Waiting for Review', 'warning'],
    [VersionState.InReview, 'In Review', 'warning'],
    [VersionState.Rejected, 'Rejected', 'danger'],
    [VersionState.DeveloperRejected, 'Developer Rejected', 'danger'],
    [VersionState.PendingDeveloperRelease, 'Pending Release', 'info'],
  ] as const)('statusLabel/statusTone for %s → %s / %s', (state, label, tone) => {
    const v = new Version('v-1', 'app-1', '1.0', state, 'IOS', {});
    expect(v.statusLabel).toBe(label);
    expect(v.statusTone).toBe(tone);
  });

  // ── Hydration ──

  it('hydrates from API JSON', () => {
    const json = {
      id: 'v-1',
      appId: 'app-1',
      versionString: '2.0',
      state: 'PREPARE_FOR_SUBMISSION',
      platform: 'IOS',
      affordances: { submitForReview: 'asc versions submit --id v-1' },
    };

    const v = Version.fromJSON(json);

    expect(v.id).toBe('v-1');
    expect(v.appId).toBe('app-1');
    expect(v.versionString).toBe('2.0');
    expect(v.isEditable).toBe(true);
    expect(v.canSubmit).toBe(true);
  });

  it('hydrates with empty affordances when missing from JSON', () => {
    const json = {
      id: 'v-1',
      appId: 'app-1',
      versionString: '1.0',
      state: 'READY_FOR_SALE',
      platform: 'IOS',
    };

    const v = Version.fromJSON(json);

    expect(v.affordances).toEqual({});
    expect(v.canSubmit).toBe(false);
    expect(v.canRelease).toBe(false);
    expect(v.isLive).toBe(true);
  });

  // ── Mutable fields + setters (post-migration) ──

  it('defaults copyright=null, releaseType=MANUAL, earliestReleaseDate=null', () => {
    const v = new Version('v-1', 'app-1', '1.0', VersionState.PrepareForSubmission, 'IOS', {});
    expect(v.copyright).toBeNull();
    expect(v.releaseType).toBe(ReleaseType.Manual);
    expect(v.earliestReleaseDate).toBeNull();
    expect(v.hasUnsavedChanges).toBe(false);
  });

  it('accepts copyright + releaseType + earliestReleaseDate via options-object init', () => {
    const v = new Version({
      id: 'v-1', appId: 'app-1', versionString: '1.0',
      state: VersionState.PrepareForSubmission, platform: 'IOS', affordances: {},
      copyright: '© 2026 Me', releaseType: ReleaseType.Scheduled,
      earliestReleaseDate: '2026-05-01T00:00:00Z',
    });
    expect(v.copyright).toBe('© 2026 Me');
    expect(v.releaseType).toBe(ReleaseType.Scheduled);
    expect(v.earliestReleaseDate).toBe('2026-05-01T00:00:00Z');
  });

  it('setVersionString / setCopyright / setReleaseType / setEarliestReleaseDate flip dirty', () => {
    const v = new Version('v-1', 'app-1', '1.0', VersionState.PrepareForSubmission, 'IOS', {});
    v.setVersionString('2.0');
    expect(v.hasUnsavedChanges).toBe(true);

    v.discard();
    v.setCopyright('© 2026');
    expect(v.hasUnsavedChanges).toBe(true);

    v.discard();
    v.setReleaseType(ReleaseType.AfterApproval);
    expect(v.hasUnsavedChanges).toBe(true);

    v.discard();
    v.setEarliestReleaseDate('2026-05-01T00:00:00Z');
    expect(v.hasUnsavedChanges).toBe(true);
  });

  it('discard restores copyright / releaseType / earliestReleaseDate to snapshot', () => {
    const v = new Version({
      id: 'v-1', appId: 'app-1', versionString: '1.0',
      state: VersionState.PrepareForSubmission, platform: 'IOS', affordances: {},
      copyright: '© 2026', releaseType: ReleaseType.Manual,
      earliestReleaseDate: null,
    });
    v.setCopyright('changed');
    v.setReleaseType(ReleaseType.Scheduled);
    v.setEarliestReleaseDate('2027-01-01T00:00:00Z');

    v.discard();

    expect(v.copyright).toBe('© 2026');
    expect(v.releaseType).toBe(ReleaseType.Manual);
    expect(v.earliestReleaseDate).toBeNull();
    expect(v.hasUnsavedChanges).toBe(false);
  });

  it('markSaved clears dirty and makes current values the new snapshot', () => {
    const v = new Version('v-1', 'app-1', '1.0', VersionState.PrepareForSubmission, 'IOS', {});
    v.setVersionString('2.0');
    v.markSaved();

    expect(v.hasUnsavedChanges).toBe(false);

    // After markSaved, discarding a further change should restore to 2.0, not 1.0.
    v.setVersionString('3.0');
    v.discard();
    expect(v.versionString).toBe('2.0');
  });

  // ── Navigation: save + loadLocalizations ──

  it('save delegates to the repository and clears dirty on success', async () => {
    const repo = {
      listLocalizations: vi.fn(),
      save: vi.fn().mockResolvedValue(undefined),
    };
    const v = new Version('v-1', 'app-1', '1.0', VersionState.PrepareForSubmission, 'IOS', {});
    v.setRepository(repo);
    v.setVersionString('2.0');

    await v.save();

    expect(repo.save).toHaveBeenCalledWith(v);
    expect(v.hasUnsavedChanges).toBe(false);
  });

  it('save throws when no repository is attached', async () => {
    const v = new Version('v-1', 'app-1', '1.0', VersionState.PrepareForSubmission, 'IOS', {});
    await expect(v.save()).rejects.toThrow(/no repository/i);
  });

  it('loadLocalizations populates localizations via the repository', async () => {
    const loaded = [
      new VersionLocalization({
        id: 'loc-1', locale: 'en-US', description: 'desc', keywords: 'k',
        whatsNew: '', promotionalText: '', supportUrl: null, marketingUrl: null,
      }),
    ];
    const repo = {
      listLocalizations: vi.fn().mockResolvedValue(loaded),
      save: vi.fn(),
    };
    const v = new Version('v-1', 'app-1', '1.0', VersionState.PrepareForSubmission, 'IOS', {});
    v.setRepository(repo);

    await v.loadLocalizations();

    expect(v.localizations).toEqual(loaded);
    expect(repo.listLocalizations).toHaveBeenCalledWith(v);
  });

  it('loadLocalizations throws when no repository is attached', async () => {
    const v = new Version('v-1', 'app-1', '1.0', VersionState.PrepareForSubmission, 'IOS', {});
    await expect(v.loadLocalizations()).rejects.toThrow(/no repository/i);
  });

  it('localizationFor returns the matching localization', async () => {
    const en = new VersionLocalization({
      id: 'loc-1', locale: 'en-US', description: 'desc', keywords: '',
      whatsNew: '', promotionalText: '', supportUrl: null, marketingUrl: null,
    });
    const de = new VersionLocalization({
      id: 'loc-2', locale: 'de-DE', description: 'beschrieb', keywords: '',
      whatsNew: '', promotionalText: '', supportUrl: null, marketingUrl: null,
    });
    const repo = { listLocalizations: vi.fn().mockResolvedValue([en, de]), save: vi.fn() };
    const v = new Version('v-1', 'app-1', '1.0', VersionState.PrepareForSubmission, 'IOS', {});
    v.setRepository(repo);
    await v.loadLocalizations();

    expect(v.localizationFor('de-DE')).toBe(de);
    expect(v.localizationFor('zz-ZZ')).toBeUndefined();
  });

  it('hasUnsavedChanges composes with dirty localizations', async () => {
    const loc = new VersionLocalization({
      id: 'loc-1', locale: 'en-US', description: 'd', keywords: '',
      whatsNew: '', promotionalText: '', supportUrl: null, marketingUrl: null,
    });
    const repo = { listLocalizations: vi.fn().mockResolvedValue([loc]), save: vi.fn() };
    const v = new Version('v-1', 'app-1', '1.0', VersionState.PrepareForSubmission, 'IOS', {});
    v.setRepository(repo);
    await v.loadLocalizations();

    expect(v.hasUnsavedChanges).toBe(false);
    loc.setDescription('edited');
    expect(v.hasUnsavedChanges).toBe(true);
  });

  it('discard also resets each child localization to its snapshot', async () => {
    const loc = new VersionLocalization({
      id: 'loc-1', locale: 'en-US', description: 'original', keywords: '',
      whatsNew: '', promotionalText: '', supportUrl: null, marketingUrl: null,
    });
    const repo = { listLocalizations: vi.fn().mockResolvedValue([loc]), save: vi.fn() };
    const v = new Version('v-1', 'app-1', '1.0', VersionState.PrepareForSubmission, 'IOS', {});
    v.setRepository(repo);
    await v.loadLocalizations();
    loc.setDescription('edited');
    v.setCopyright('new');

    v.discard();

    expect(loc.description).toBe('original');
    expect(v.copyright).toBeNull();
    expect(v.hasUnsavedChanges).toBe(false);
  });

  // ── fromJSON: new fields ──

  it('fromJSON hydrates copyright / releaseType / earliestReleaseDate', () => {
    const v = Version.fromJSON({
      id: 'v-1',
      appId: 'app-1',
      versionString: '2.0',
      state: 'PREPARE_FOR_SUBMISSION',
      platform: 'IOS',
      copyright: '© 2026 Acme',
      releaseType: 'SCHEDULED',
      earliestReleaseDate: '2026-05-01T00:00:00Z',
    });
    expect(v.copyright).toBe('© 2026 Acme');
    expect(v.releaseType).toBe(ReleaseType.Scheduled);
    expect(v.earliestReleaseDate).toBe('2026-05-01T00:00:00Z');
  });

  it('fromJSON defaults releaseType to MANUAL when absent', () => {
    const v = Version.fromJSON({
      id: 'v-1', appId: 'app-1', versionString: '1.0',
      state: 'READY_FOR_SALE', platform: 'IOS',
    });
    expect(v.releaseType).toBe(ReleaseType.Manual);
  });
});
