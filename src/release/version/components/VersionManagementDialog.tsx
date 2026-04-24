import { useEffect, useMemo, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { App } from '../../../app-catalog/app/App.ts';
import { Platform } from '../Version.ts';
import { RadioCard } from '../../../shared/components/RadioCard.tsx';

interface Props {
  app: App;
  /** Platform to pre-select when the dialog opens. Defaults to the currently
   *  selected version's platform, then iOS. */
  initialPlatform?: Platform;
  onClose: () => void;
}

/**
 * Port of the native macOS `VersionManagementSheet` to the web UI.
 *
 * Single sheet with two behaviours:
 *  • Create mode — no editable version exists for the selected platform.
 *    Submits `app.createVersion({ platform, versionString, copyright })`.
 *  • Update mode — an editable version (PrepareForSubmission / Rejected)
 *    exists for the platform. Submits a versionString/copyright change via
 *    the existing `version.save()` PATCH path.
 *
 * The platform picker re-evaluates mode on change, re-binds the input to the
 * matching editable version, and flips the action button label.
 */
export const VersionManagementDialog = observer(function VersionManagementDialog({
  app,
  initialPlatform,
  onClose,
}: Props) {
  const [platform, setPlatform] = useState<Platform>(
    initialPlatform ?? (app.selectedVersion?.platform as Platform | undefined) ?? Platform.iOS,
  );

  const editableVersion = app.editableVersionForPlatform(platform);
  const isUpdateMode = editableVersion !== null;

  const [versionString, setVersionString] = useState<string>(editableVersion?.versionString ?? '');
  const [copyright, setCopyright] = useState<string>(editableVersion?.copyright ?? '');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-bind inputs when the user switches platform — matches the Swift
  // sheet's `loadVersionForSelectedPlatform()` behaviour.
  useEffect(() => {
    setVersionString(editableVersion?.versionString ?? '');
    setCopyright(editableVersion?.copyright ?? '');
    setError(null);
  }, [platform]); // eslint-disable-line react-hooks/exhaustive-deps

  const trimmed = versionString.trim();

  const isAlreadyPublished = useMemo(() => {
    if (trimmed.length === 0) return false;
    return app.versions.some((v) =>
      v.platform === platform &&
      v !== editableVersion &&
      v.versionString === trimmed,
    );
  }, [app.versions, platform, trimmed, editableVersion]);

  const unchanged =
    isUpdateMode &&
    trimmed === editableVersion!.versionString &&
    (copyright.trim() || null) === editableVersion!.copyright;

  const cannotCreateHere = !isUpdateMode && !app.canCreateVersion;
  const isDisabled =
    processing ||
    trimmed.length === 0 ||
    isAlreadyPublished ||
    unchanged ||
    cannotCreateHere;

  async function submit(): Promise<void> {
    setProcessing(true);
    setError(null);
    try {
      if (isUpdateMode && editableVersion) {
        editableVersion.setVersionString(trimmed);
        editableVersion.setCopyright(copyright.trim() || null);
        await editableVersion.save();
      } else {
        await app.createVersion({
          platform,
          versionString: trimmed,
          copyright: copyright.trim() || null,
        });
      }
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="modal-overlay open" role="dialog" aria-modal="true" aria-labelledby="vm-title">
      <div className="modal" style={{ maxWidth: 560 }}>
        <div className="modal-header">
          <h3 id="vm-title">
            {isUpdateMode ? `✎  Update Version` : `+  Create New Version`}
          </h3>
          <button type="button" className="modal-close" aria-label="Close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Platform</label>
            <RadioCard
              name="vm-platform"
              selectedTone="blue"
              value={platform}
              onChange={(id) => setPlatform(id as Platform)}
              options={PLATFORM_OPTIONS}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="vm-version">
              Version Number <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <input
              id="vm-version"
              className="form-input"
              value={versionString}
              placeholder="1.0.0"
              onChange={(e) => setVersionString(e.target.value)}
              autoFocus
            />
            {isAlreadyPublished && (
              <div className="form-hint" style={{ color: '#b45309' }}>
                A version with this number already exists on {PLATFORM_LABELS[platform]}.
              </div>
            )}
            {cannotCreateHere && (
              <div className="form-hint" style={{ color: '#b45309' }}>
                No editable version exists for {PLATFORM_LABELS[platform]} and the
                backend doesn't expose a createVersion affordance — pick another
                platform or ask the backend to ship the affordance.
              </div>
            )}
            <div className="form-hint">
              Semantic versioning (e.g. 1.0.0).{' '}
              {isUpdateMode
                ? `Editing ${editableVersion!.versionString} — ${editableVersion!.statusLabel}.`
                : 'A new version will be created in Prepare-for-Submission state.'}
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="vm-copyright">Copyright</label>
            <input
              id="vm-copyright"
              className="form-input"
              value={copyright}
              placeholder="© 2026 Your Company"
              onChange={(e) => setCopyright(e.target.value)}
            />
            <div className="form-hint">Optional.</div>
          </div>

          {error && (
            <div
              className="form-hint"
              role="alert"
              style={{ color: 'var(--danger-text, #b91c1c)', marginTop: 12 }}
            >
              {error}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={processing}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={submit} disabled={isDisabled}>
            {processing
              ? (isUpdateMode ? 'Updating…' : 'Creating…')
              : (isUpdateMode ? 'Update' : 'Create')}
          </button>
        </div>
      </div>
    </div>
  );
});

const PLATFORM_LABELS: Record<Platform, string> = {
  [Platform.iOS]: 'iOS',
  [Platform.macOS]: 'macOS',
  [Platform.tvOS]: 'tvOS',
  [Platform.visionOS]: 'visionOS',
};

const PLATFORM_OPTIONS = [
  { id: Platform.iOS,      title: 'iOS',      sub: 'iPhone & iPad'    },
  { id: Platform.macOS,    title: 'macOS',    sub: 'Mac'              },
  { id: Platform.tvOS,     title: 'tvOS',     sub: 'Apple TV'         },
  { id: Platform.visionOS, title: 'visionOS', sub: 'Apple Vision Pro' },
];
