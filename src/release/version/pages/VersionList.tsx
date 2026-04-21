import { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useWorkspace } from '../../../workspace/ASCWorkspace.hooks.tsx';
import { ReleaseType, type Version } from '../Version.ts';
import { RadioCard } from '../../../shared/components/RadioCard.tsx';

function VersionPage() {
  const workspace = useWorkspace();
  const currentApp = workspace?.currentApp ?? null;
  const version = currentApp?.selectedVersion ?? null;

  // Load per-locale text the first time we see this version.
  const [locsLoading, setLocsLoading] = useState(false);
  const [locsError, setLocsError] = useState<Error | null>(null);
  useEffect(() => {
    if (!version) return;
    if (version.localizations.length > 0) return; // already loaded
    if (!version.repository) return;

    let cancelled = false;
    setLocsLoading(true);
    setLocsError(null);
    version.loadLocalizations()
      .catch((e) => { if (!cancelled) setLocsError(e as Error); })
      .finally(() => { if (!cancelled) setLocsLoading(false); });

    return () => { cancelled = true; };
  }, [version?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!workspace?.hydrated) return <div className="spinner">Loading…</div>;

  if (!currentApp) {
    return (
      <div className="card">
        <div className="empty-state">
          <h3>No app selected</h3>
          <p>Pick an app from the sidebar to view its versions.</p>
        </div>
      </div>
    );
  }

  if (!version) {
    return (
      <div className="card">
        <div className="empty-state">
          <h3>No version available</h3>
          <p>This app has no versions yet.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-info-wrap">
      <VersionReleaseCard version={version} />
      <StoryDescriptionCard version={version} locsLoading={locsLoading} locsError={locsError} />
      <SupportContactCard version={version} />
      <VersionSaveBar version={version} />
    </div>
  );
}

// ─── Version & Release ─────────────────────────────────────────────

const VersionReleaseCard = observer(({ version }: { version: Version }) => {
  return (
    <div className="card">
      <div className="toolbar">
        <div className="toolbar-left"><h3>Version & Release</h3></div>
      </div>
      <div className="card-body padded">
        <div className="form-row">
          <div className="form-group">
            <label className="form-label" htmlFor="vr-version">
              Version Number <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <input
              id="vr-version"
              className="form-input"
              value={version.versionString}
              placeholder="1.0.0"
              onChange={(e) => version.setVersionString(e.target.value)}
            />
            <div className="form-hint">Follow semantic versioning (e.g. 1.0.0).</div>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="vr-copyright">Copyright</label>
            <input
              id="vr-copyright"
              className="form-input"
              value={version.copyright ?? ''}
              placeholder="© 2026 Your Company"
              onChange={(e) => version.setCopyright(e.target.value || null)}
            />
            <div className="form-hint">Optional · Protects your intellectual property.</div>
          </div>
        </div>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Release Type</label>
          <RadioCard
            name="release-type"
            selectedTone="green"
            value={version.releaseType}
            onChange={(id) => version.setReleaseType(id as ReleaseType)}
            options={[
              {
                id: ReleaseType.Manual,
                title: 'Manual',
                sub: 'Release manually after approval',
              },
              {
                id: ReleaseType.AfterApproval,
                title: 'After Approval',
                sub: 'Release automatically after approval',
              },
              {
                id: ReleaseType.Scheduled,
                title: 'Scheduled',
                sub: 'Release on a specific date after approval',
              },
            ]}
          />
          {version.releaseType === ReleaseType.Scheduled && (
            <div style={{ marginTop: 12, maxWidth: 260 }}>
              <label className="form-label" htmlFor="vr-date">Release Date</label>
              <input
                id="vr-date"
                type="date"
                className="form-input"
                value={version.earliestReleaseDate?.slice(0, 10) ?? ''}
                onChange={(e) =>
                  version.setEarliestReleaseDate(
                    e.target.value ? new Date(e.target.value).toISOString() : null,
                  )
                }
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

// ─── Story & Description ───────────────────────────────────────────

const StoryDescriptionCard = observer(({
  version, locsLoading, locsError,
}: {
  version: Version;
  locsLoading: boolean;
  locsError: Error | null;
}) => {
  const primary = version.localizations.find((l) => l.locale === 'en-US') ?? version.localizations[0];

  return (
    <div className="card">
      <div className="toolbar">
        <div className="toolbar-left">
          <h3>Story & Description</h3>
          {primary && <span className="platform-badge" style={{ marginLeft: 8, fontSize: 9 }}>{primary.locale}</span>}
        </div>
      </div>
      <div className="card-body padded">
        {locsLoading && <div className="form-hint">Loading localizations…</div>}
        {locsError && <div className="form-hint" style={{ color: 'var(--danger-text)' }}>Error: {locsError.message}</div>}
        {!locsLoading && !primary && (
          <div className="form-hint">No localization found for this version.</div>
        )}
        {primary && (
          <>
            <div className="form-group">
              <label className="form-label" htmlFor="sd-description">
                App Description <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <textarea
                id="sd-description"
                className="form-input"
                rows={8}
                maxLength={4000}
                value={primary.description}
                placeholder="Tell users what your app does"
                onChange={(e) => primary.setDescription(e.target.value)}
              />
              <div className="form-hint">
                Required · {primary.description.length.toLocaleString()} / 4,000 characters
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="sd-whatsnew">What's New</label>
              <textarea
                id="sd-whatsnew"
                className="form-input"
                rows={4}
                maxLength={4000}
                value={primary.whatsNew}
                placeholder="Describe what's new in this version…"
                onChange={(e) => primary.setWhatsNew(e.target.value)}
              />
              <div className="form-hint">
                Optional · {primary.whatsNew.length.toLocaleString()} / 4,000 characters
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="sd-keywords">Keywords</label>
              <input
                id="sd-keywords"
                className="form-input"
                maxLength={100}
                value={primary.keywords}
                placeholder="subscription,tracker,calendar"
                onChange={(e) => primary.setKeywords(e.target.value)}
              />
              <div className="form-hint">
                Comma-separated · {primary.keywords.length} / 100 characters
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="sd-promo">Promotional Text</label>
              <input
                id="sd-promo"
                className="form-input"
                maxLength={170}
                value={primary.promotionalText}
                placeholder="Appears above the description, can be updated anytime"
                onChange={(e) => primary.setPromotionalText(e.target.value)}
              />
              <div className="form-hint">
                Optional · {primary.promotionalText.length} / 170 characters
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
});

// ─── Support Contact ───────────────────────────────────────────────

const SupportContactCard = observer(({ version }: { version: Version }) => {
  const primary = version.localizations.find((l) => l.locale === 'en-US') ?? version.localizations[0];

  if (!primary) return null;

  return (
    <div className="card">
      <div className="toolbar">
        <div className="toolbar-left">
          <h3>Support Contact</h3>
          <span className="platform-badge" style={{ marginLeft: 8, fontSize: 9 }}>{primary.locale}</span>
        </div>
      </div>
      <div className="card-body padded">
        <div className="form-group">
          <label className="form-label" htmlFor="sc-support">
            Support URL <span style={{ color: '#dc2626' }}>*</span>
          </label>
          <input
            id="sc-support"
            className="form-input"
            placeholder="https://yourwebsite.com/support"
            value={primary.supportUrl ?? ''}
            onChange={(e) => primary.setSupportUrl(e.target.value || null)}
          />
          <div className="form-hint">Required · Where users can get help with your app.</div>
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label" htmlFor="sc-marketing">Marketing URL</label>
          <input
            id="sc-marketing"
            className="form-input"
            placeholder="https://yourwebsite.com"
            value={primary.marketingUrl ?? ''}
            onChange={(e) => primary.setMarketingUrl(e.target.value || null)}
          />
          <div className="form-hint">Optional · A landing page for your app.</div>
        </div>
      </div>
    </div>
  );
});

// ─── Save bar ──────────────────────────────────────────────────────

const VersionSaveBar = observer(({ version }: { version: Version }) => {
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  if (!version.hasUnsavedChanges && !saving) return null;

  const handleSave = async () => {
    setSaving(true);
    setMsg(null);
    try {
      await version.save();
      setMsg({ kind: 'ok', text: 'Saved' });
      setTimeout(() => setMsg(null), 2000);
    } catch (err) {
      setMsg({ kind: 'error', text: (err as Error).message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="save-bar" role="region" aria-label="Unsaved changes">
      <div className="save-bar-inner">
        <span className="save-bar-status">
          {msg?.kind === 'error'
            ? <span className="save-bar-error">Save failed: {msg.text}</span>
            : msg?.kind === 'ok' ? <span style={{ color: 'var(--success-text)', fontWeight: 600 }}>{msg.text}</span>
            : <span>You have unsaved changes</span>}
        </span>
        <div className="save-bar-actions">
          <button type="button" className="btn btn-secondary" onClick={() => version.discard()} disabled={saving}>
            Discard
          </button>
          <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
});

export default observer(VersionPage);
