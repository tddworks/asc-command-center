import { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { workspace } from '../../../workspace/workspaceInstance.ts';
import { ReleaseType, type Version } from '../Version.ts';
import { RadioCard } from '../../../shared/components/RadioCard.tsx';
import { PluginSlot } from '../../../extensibility/plugin/PluginSlot.tsx';
import type { TextEditKind, BatchTargets } from '../../../extensibility/plugin/slots.ts';
import type { VersionLocalization } from '../VersionLocalization.ts';
import { localeDisplayName } from '../../../shared/AppStoreLocaleRegistry.ts';

function VersionPage() {
  const currentApp = workspace.currentApp;
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

  // Which locale's fields the Story / Support cards show. Defaults to the
  // app's primary locale; resets when the app or version changes.
  const defaultLocale =
    currentApp?.primaryLocale ??
    version?.localizations[0]?.locale ??
    'en-US';
  const [selectedLocale, setSelectedLocale] = useState<string>(defaultLocale);
  useEffect(() => {
    setSelectedLocale(defaultLocale);
  }, [defaultLocale, version?.id]);

  if (!workspace.hydrated) return <div className="loading"><span className="spinner" /><span>Loading…</span></div>;

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

  const isFirstVersion = currentApp.isFirstVersion(version);

  return (
    <div className="app-info-wrap">
      <VersionReleaseCard version={version} />
      <StoryDescriptionCard
        version={version}
        selectedLocale={selectedLocale}
        onLocaleChange={setSelectedLocale}
        primaryLocale={currentApp.primaryLocale}
        isFirstVersion={isFirstVersion}
        locsLoading={locsLoading}
        locsError={locsError}
      />
      <SupportContactCard version={version} selectedLocale={selectedLocale} />
      <VersionSaveBar version={version} />
    </div>
  );
}

// ─── Batch translate fanout ────────────────────────────────────────
//
// When the user is editing the primary locale, the `text.edit` plugin slot
// gets a `batch` payload listing every sibling locale's matching field plus
// a setter — the AI plugin can then translate once and write into all
// locales in one click. Sibling locales (non-primary) omit `batch` so the
// button only appears on the primary card, mirroring the AppInfo flow.
type StoryField = 'description' | 'whatsNew' | 'keywords' | 'promotionalText';

function readField(loc: VersionLocalization, field: StoryField): string {
  switch (field) {
    case 'description': return loc.description;
    case 'whatsNew': return loc.whatsNew;
    case 'keywords': return loc.keywords;
    case 'promotionalText': return loc.promotionalText;
  }
}

function writeField(loc: VersionLocalization, field: StoryField, v: string): void {
  switch (field) {
    case 'description': loc.setDescription(v); return;
    case 'whatsNew': loc.setWhatsNew(v); return;
    case 'keywords': loc.setKeywords(v); return;
    case 'promotionalText': loc.setPromotionalText(v); return;
  }
}

function batchFor(
  version: Version,
  primaryLocale: string,
  field: StoryField,
  sourceText: string,
): BatchTargets {
  const targets = version.localizations
    .filter((l) => l.locale !== primaryLocale)
    .map((l) => ({
      locale: l.locale,
      current: readField(l, field),
      setText: (v: string) => writeField(l, field, v),
    }));
  return { sourceLocale: primaryLocale, sourceText, targets };
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

// ─── Language switcher (used in multiple cards) ─────────────────────

const LanguageSwitcher = observer(({
  version, primaryLocale, value, onChange,
}: {
  version: Version;
  primaryLocale: string;
  value: string;
  onChange: (locale: string) => void;
}) => {
  const locales = version.localizations.map((l) => l.locale);
  if (locales.length === 0) return null;

  // Sort: primary first, then alphabetical by display name. Pin the primary
  // at the top so the user always sees it without scrolling, and group the
  // rest in a stable, name-driven order.
  const sorted = [...locales].sort((a, b) => {
    if (a === primaryLocale) return -1;
    if (b === primaryLocale) return 1;
    return localeDisplayName(a).localeCompare(localeDisplayName(b));
  });

  const labelFor = (code: string): string => {
    const name = localeDisplayName(code) || code;
    return code === primaryLocale ? `${name} · primary` : name;
  };

  return (
    <span className="language-switcher">
      <span className="language-switcher-label">Language</span>
      <span className="language-switcher-pill">
        <span>{labelFor(value)}</span>
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <polyline points="5 6 8 9 11 6"/>
        </svg>
        <select
          aria-label="Select language"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          {sorted.map((l) => (
            <option key={l} value={l}>
              {labelFor(l)}
            </option>
          ))}
        </select>
      </span>
    </span>
  );
});

// ─── Story & Description ───────────────────────────────────────────

const StoryDescriptionCard = observer(({
  version, selectedLocale, onLocaleChange, primaryLocale, isFirstVersion, locsLoading, locsError,
}: {
  version: Version;
  selectedLocale: string;
  onLocaleChange: (locale: string) => void;
  primaryLocale: string;
  isFirstVersion: boolean;
  locsLoading: boolean;
  locsError: Error | null;
}) => {
  const loc = version.localizationFor(selectedLocale);
  const isPrimary = selectedLocale === primaryLocale;
  const maybeBatch = (field: StoryField, text: string): BatchTargets | undefined =>
    isPrimary ? batchFor(version, primaryLocale, field, text) : undefined;

  return (
    <div className="card">
      <div className="toolbar">
        <div className="toolbar-left">
          <h3>Story & Description</h3>
        </div>
        <div className="toolbar-right">
          <LanguageSwitcher
            version={version}
            primaryLocale={primaryLocale}
            value={selectedLocale}
            onChange={onLocaleChange}
          />
        </div>
      </div>
      <div className="card-body padded">
        {locsLoading && <div className="form-hint">Loading localizations…</div>}
        {locsError && <div className="form-hint" style={{ color: 'var(--danger-text)' }}>Error: {locsError.message}</div>}
        {!locsLoading && !loc && (
          <div className="form-hint">
            No localization for <code>{selectedLocale}</code>. Add it in App Info → Localizations first.
          </div>
        )}
        {loc && (
          <>
            <div className="form-group">
              <VersionFieldHeader
                htmlFor="sd-description"
                label={<>App Description <span style={{ color: '#dc2626' }}>*</span></>}
                kind="version.description"
                text={loc.description}
                onChange={(v) => loc.setDescription(v)}
                locale={loc.locale}
                maxLength={4000}
                version={version}
                batch={maybeBatch('description', loc.description)}
              />
              <textarea
                id="sd-description"
                className="form-input"
                rows={8}
                maxLength={4000}
                value={loc.description}
                placeholder="Tell users what your app does"
                onChange={(e) => loc.setDescription(e.target.value)}
              />
              <div className="form-hint">
                Required · {loc.description.length.toLocaleString()} / 4,000 characters
              </div>
            </div>

            {!isFirstVersion && (
              <div className="form-group">
                <VersionFieldHeader
                  htmlFor="sd-whatsnew"
                  label="What's New"
                  kind="version.whatsNew"
                  text={loc.whatsNew}
                  onChange={(v) => loc.setWhatsNew(v)}
                  locale={loc.locale}
                  maxLength={4000}
                  version={version}
                  batch={maybeBatch('whatsNew', loc.whatsNew)}
                />
                <textarea
                  id="sd-whatsnew"
                  className="form-input"
                  rows={4}
                  maxLength={4000}
                  value={loc.whatsNew}
                  placeholder="Describe what's new in this version…"
                  onChange={(e) => loc.setWhatsNew(e.target.value)}
                />
                <div className="form-hint">
                  Optional · {loc.whatsNew.length.toLocaleString()} / 4,000 characters
                </div>
              </div>
            )}

            <div className="form-group">
              <VersionFieldHeader
                htmlFor="sd-keywords"
                label="Keywords"
                kind="version.keywords"
                text={loc.keywords}
                onChange={(v) => loc.setKeywords(v)}
                locale={loc.locale}
                maxLength={100}
                version={version}
                batch={maybeBatch('keywords', loc.keywords)}
              />
              <input
                id="sd-keywords"
                className="form-input"
                maxLength={100}
                value={loc.keywords}
                placeholder="subscription,tracker,calendar"
                onChange={(e) => loc.setKeywords(e.target.value)}
              />
              <div className="form-hint">
                Comma-separated · {loc.keywords.length} / 100 characters
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <VersionFieldHeader
                htmlFor="sd-promo"
                label="Promotional Text"
                kind="version.promotionalText"
                text={loc.promotionalText}
                onChange={(v) => loc.setPromotionalText(v)}
                locale={loc.locale}
                maxLength={170}
                version={version}
                batch={maybeBatch('promotionalText', loc.promotionalText)}
              />
              <input
                id="sd-promo"
                className="form-input"
                maxLength={170}
                value={loc.promotionalText}
                placeholder="Appears above the description, can be updated anytime"
                onChange={(e) => loc.setPromotionalText(e.target.value)}
              />
              <div className="form-hint">
                Optional · {loc.promotionalText.length} / 170 characters
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
});

/** Label + `text.edit` plugin slot on one row. Keeps the four Story &
 *  Description fields tidy without repeating the same 10 lines of
 *  boilerplate per field. */
function VersionFieldHeader({
  htmlFor, label, kind, text, onChange, locale, maxLength, version, batch,
}: {
  htmlFor: string;
  label: React.ReactNode;
  kind: Extract<TextEditKind, `version.${string}`>;
  text: string;
  onChange: (v: string) => void;
  locale: string;
  maxLength?: number;
  version: Version;
  batch?: BatchTargets;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
      <label className="form-label" htmlFor={htmlFor}>{label}</label>
      <PluginSlot
        slot="text.edit"
        ctx={{ slot: 'text.edit', kind, text, onChange, locale, maxLength, version, batch }}
      />
    </div>
  );
}

// ─── Support Contact ───────────────────────────────────────────────

const SupportContactCard = observer(({ version, selectedLocale }: { version: Version; selectedLocale: string }) => {
  const loc = version.localizationFor(selectedLocale);
  if (!loc) return null;

  return (
    <div className="card">
      <div className="toolbar">
        <div className="toolbar-left">
          <h3>Support Contact</h3>
          <span className="platform-badge" style={{ marginLeft: 8, fontSize: 9 }}>{loc.locale}</span>
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
            value={loc.supportUrl ?? ''}
            onChange={(e) => loc.setSupportUrl(e.target.value || null)}
          />
          <div className="form-hint">Required · Where users can get help with your app.</div>
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label" htmlFor="sc-marketing">Marketing URL</label>
          <input
            id="sc-marketing"
            className="form-input"
            placeholder="https://yourwebsite.com"
            value={loc.marketingUrl ?? ''}
            onChange={(e) => loc.setMarketingUrl(e.target.value || null)}
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
