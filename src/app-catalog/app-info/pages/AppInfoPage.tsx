import { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { workspace } from '../../../workspace/workspaceInstance.ts';
import type { AppInfo } from '../AppInfo.ts';
import type { AppInfoLocalization } from '../AppInfoLocalization.ts';
import type { App } from '../../app/App.ts';
import { RadioCard } from '../../../shared/components/RadioCard.tsx';
import { APP_CATEGORIES } from '../AppCategoryRegistry.ts';
import { AgeRatingWizardSheet } from '../../age-rating/pages/AgeRatingWizardSheet.tsx';
import { PluginSlot } from '../../../extensibility/plugin/PluginSlot.tsx';
import type { BatchTargets } from '../../../extensibility/plugin/slots.ts';
import { LocalePickerSheet } from '../components/LocalePickerSheet.tsx';
import { localeDisplayName } from '../AppStoreLocaleRegistry.ts';

// Build cross-locale batch targets for a single field. Called by the
// primary-locale slot so the plugin can fan out one enhancement across
// every sibling locale. Siblings omit `batch` to avoid double-rendering
// the button.
function batchFor(
  appInfo: AppInfo,
  field: 'name' | 'subtitle',
  sourceText: string,
): BatchTargets {
  const targets = appInfo.localizations
    .filter((l) => l.locale !== appInfo.primaryLocale)
    .map((l) => ({
      locale: l.locale,
      current: field === 'name' ? l.name : (l.subtitle ?? ''),
      setText: (v: string) => {
        if (field === 'name') l.setName(v);
        else l.setSubtitle(v || null);
      },
    }));
  return { sourceLocale: appInfo.primaryLocale, sourceText, targets };
}

// Human-friendly labels for Apple's age-rating api ids.
const AGE_RATING_LABELS: Record<string, { label: string; sub: string }> = {
  FOUR_PLUS:      { label: '4+',  sub: 'No objectionable content' },
  NINE_PLUS:      { label: '9+',  sub: 'Infrequent/mild content' },
  TWELVE_PLUS:    { label: '12+', sub: 'Frequent/intense content' },
  SEVENTEEN_PLUS: { label: '17+', sub: 'Mature content' },
  UNRATED:        { label: '—',   sub: 'Not yet rated' },
};

function AppInfoPage() {
  const currentApp = workspace.currentApp;
  const selectedVersion = currentApp?.selectedVersion ?? null;

  // Domain-driven loading — `App.loadAppInfos` populates `app.appInfos` and
  // the component picks the row matching the selected version via
  // `appInfoFor(state)`. No slice-level hook needed.
  const [loading, setLoading] = useState<boolean>(!!currentApp);
  const [error, setError] = useState<Error | null>(null);
  useEffect(() => {
    if (!currentApp) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    setError(null);
    currentApp.loadAppInfos()
      .catch((e) => { if (!cancelled) setError(e as Error); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [currentApp?.id]);

  const appInfo = currentApp?.appInfoFor(selectedVersion?.state ?? null) ?? null;

  if (!workspace.hydrated) return <div className="loading"><span className="spinner" /><span>Loading…</span></div>;

  if (!currentApp) {
    return (
      <div className="card">
        <div className="empty-state">
          <h3>No app selected</h3>
          <p>Pick an app from the sidebar to view its metadata.</p>
        </div>
      </div>
    );
  }

  if (loading) return <div className="loading"><span className="spinner" /><span>Loading app info…</span></div>;

  if (error || !appInfo) {
    return (
      <div className="card">
        <div className="empty-state">
          <h3>Couldn't load App Info</h3>
          <p>{error?.message ?? 'Unknown error.'}</p>
        </div>
      </div>
    );
  }

  // Single read-only gate: the selected version's editability. AppInfo is
  // editable only when its corresponding version is editable (or rejected).
  // The user picks the version in the global picker; the page reflects that
  // choice without inventing a separate per-card capability.
  const readOnly = !currentApp.canEdit;

  return (
    <div className="app-info-wrap">
      <AppIdentityStrip app={currentApp} />
      {readOnly && <ReadOnlyBanner app={currentApp} />}
      <AppMetadataCard appInfo={appInfo} readOnly={readOnly} />
      <LocalizationsCard appInfo={appInfo} readOnly={readOnly} />
      <PrivacyComplianceCard appInfo={appInfo} readOnly={readOnly} />
      {!readOnly && <StickySaveBar appInfo={appInfo} />}
    </div>
  );
}

// ─── Read-only banner — explains why edits are disabled ─────────────

const ReadOnlyBanner = observer(({ app }: { app: App }) => {
  const v = app.selectedVersion;
  const versionDesc = v ? `${v.versionString} · ${v.statusLabel}` : 'this version';
  return (
    <div
      className="card"
      role="status"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 16px',
        borderLeft: '3px solid var(--warning, #f59e0b)',
      }}
    >
      <span aria-hidden style={{ fontSize: 16 }}>🔒</span>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
        Read-only — viewing <strong style={{ color: 'var(--text-primary)' }}>{versionDesc}</strong>.
        Switch to an editable version (Prepare for Submission) from the version picker
        to make changes, or create a new one via Manage Versions.
      </div>
    </div>
  );
});

// ─── App Identifiers — read-only identity info, mirrors the Localizations
//     table used elsewhere on this page so the visual rhythm matches.

const AppIdentityStrip = observer(({ app }: { app: App }) => {
  const rows: Array<[string, string]> = [
    ['Bundle ID', app.bundleId],
    ['SKU', app.sku],
    ['App ID', app.id],
    ['Primary Language', app.primaryLocale],
  ];
  return (
    <div className="card">
      <div className="toolbar">
        <div className="toolbar-left"><h3>App Identifiers</h3></div>
      </div>
      <div className="table-wrapper">
        <table>
          <tbody>
            {rows.map(([label, value]) => (
              <tr key={label}>
                <td style={{ width: '30%', color: 'var(--text-muted)' }}>{label}</td>
                <td className="cell-mono" style={{ textAlign: 'right' }}>{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
});

// ─── App Metadata ───────────────────────────────────────────────────

const AppMetadataCard = observer(({ appInfo, readOnly }: { appInfo: AppInfo; readOnly: boolean }) => {
  const primary = appInfo.localizationFor(appInfo.primaryLocale);
  const nameBatch = primary ? batchFor(appInfo, 'name', primary.name) : undefined;
  const subtitleBatch = primary ? batchFor(appInfo, 'subtitle', primary.subtitle ?? '') : undefined;

  return (
    <div className="card">
      <div className="toolbar">
        <div className="toolbar-left"><h3>App Metadata</h3></div>
      </div>
      <div className="card-body padded">
        <div className="form-group">
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <label className="form-label" htmlFor="am-name">App Name</label>
            {primary && !readOnly && (
              <PluginSlot
                slot="text.edit"
                ctx={{
                  slot: 'text.edit',
                  kind: 'appInfo.name',
                  text: primary.name,
                  onChange: (v) => primary.setName(v),
                  locale: appInfo.primaryLocale,
                  maxLength: 30,
                  appInfo,
                  batch: nameBatch,
                }}
              />
            )}
          </div>
          <input
            id="am-name"
            className="form-input"
            value={primary?.name ?? ''}
            placeholder="My App"
            disabled={readOnly}
            onChange={(e) => primary?.setName(e.target.value)}
          />
        </div>

        <div className="form-group">
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <label className="form-label" htmlFor="am-subtitle">Subtitle</label>
            {primary && !readOnly && (
              <PluginSlot
                slot="text.edit"
                ctx={{
                  slot: 'text.edit',
                  kind: 'appInfo.subtitle',
                  text: primary.subtitle ?? '',
                  onChange: (v) => primary.setSubtitle(v || null),
                  locale: appInfo.primaryLocale,
                  maxLength: 30,
                  appInfo,
                  batch: subtitleBatch,
                }}
              />
            )}
          </div>
          <input
            id="am-subtitle"
            className="form-input"
            value={primary?.subtitle ?? ''}
            placeholder="A short description"
            disabled={readOnly}
            onChange={(e) => primary?.setSubtitle(e.target.value || null)}
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label" htmlFor="am-category">Primary Category</label>
            <select
              id="am-category"
              className="form-input select-styled"
              value={appInfo.primaryCategoryId ?? ''}
              disabled={readOnly}
              onChange={(e) => appInfo.setPrimaryCategory(e.target.value || null)}
            >
              <option value="">—</option>
              {APP_CATEGORIES.map((c) => <option key={c.apiId} value={c.apiId}>{c.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="am-category-2">Secondary Category</label>
            <select
              id="am-category-2"
              className="form-input select-styled"
              value={appInfo.secondaryCategoryId ?? ''}
              disabled={readOnly}
              onChange={(e) => appInfo.setSecondaryCategory(e.target.value || null)}
            >
              <option value="">— None —</option>
              {APP_CATEGORIES
                .filter((c) => c.apiId !== appInfo.primaryCategoryId)
                .map((c) => <option key={c.apiId} value={c.apiId}>{c.label}</option>)}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
});

// ─── Localizations ──────────────────────────────────────────────────

const LocalizationsCard = observer(({ appInfo, readOnly }: { appInfo: AppInfo; readOnly: boolean }) => {
  const [editingLocale, setEditingLocale] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <div className="card">
      <div className="toolbar">
        <div className="toolbar-left"><h3>Localizations</h3></div>
        <div className="toolbar-right">
          {!readOnly && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => setPickerOpen(true)}
            >
              Manage Languages
            </button>
          )}
        </div>
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Locale</th>
              <th>Name</th>
              <th>Subtitle</th>
              {!readOnly && <th style={{ textAlign: 'right' }}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {appInfo.localizations.map((loc) => (
              <LocaleTableRow
                key={loc.locale}
                localization={loc}
                appInfo={appInfo}
                isPrimary={loc.locale === appInfo.primaryLocale}
                editing={editingLocale === loc.locale}
                readOnly={readOnly}
                onEdit={() => setEditingLocale(loc.locale)}
                onDone={() => setEditingLocale(null)}
                onDelete={
                  !readOnly && loc.locale !== appInfo.primaryLocale
                    ? async () => {
                        if (!confirm(`Remove ${loc.locale}?`)) return;
                        if (editingLocale === loc.locale) setEditingLocale(null);
                        try {
                          await appInfo.deleteLocalization(loc.locale);
                        } catch (err) {
                          alert(`Failed to remove ${loc.locale}: ${(err as Error).message}`);
                        }
                      }
                    : undefined
                }
              />
            ))}
          </tbody>
        </table>
      </div>

      <LocalePickerSheet
        open={pickerOpen}
        appInfo={appInfo}
        onClose={() => setPickerOpen(false)}
      />
    </div>
  );
});

interface LocaleRowProps {
  localization: AppInfoLocalization;
  appInfo: AppInfo;
  isPrimary: boolean;
  editing: boolean;
  readOnly: boolean;
  onEdit: () => void;
  onDone: () => void;
  onDelete?: () => void;
}

const LocaleTableRow = observer(({ localization, appInfo, isPrimary, editing, readOnly, onEdit, onDone, onDelete }: LocaleRowProps) => {
  // Only the primary-locale row carries `batch` — that's where the
  // batch-translate button should appear. Sibling rows translate into
  // themselves via the primary row's fanout.
  const nameBatch = isPrimary ? batchFor(appInfo, 'name', localization.name) : undefined;
  const subtitleBatch = isPrimary ? batchFor(appInfo, 'subtitle', localization.subtitle ?? '') : undefined;
  return (
    <tr>
      <td className="cell-primary">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span>
            {localeDisplayName(localization.locale) || localization.locale}
            {isPrimary && (
              <span className="platform-badge" style={{ marginLeft: 8, fontSize: 9 }}>PRIMARY</span>
            )}
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)' }}>
            {localization.locale}
          </span>
        </div>
      </td>
      <td>
        {editing && !readOnly ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              className="form-input"
              value={localization.name}
              placeholder="Name"
              style={{ flex: 1 }}
              onChange={(e) => localization.setName(e.target.value)}
            />
            <PluginSlot
              slot="text.edit"
              ctx={{
                slot: 'text.edit',
                kind: 'appInfo.name',
                text: localization.name,
                onChange: (v) => localization.setName(v),
                locale: localization.locale,
                maxLength: 30,
                appInfo,
                batch: nameBatch,
              }}
            />
          </div>
        ) : (
          localization.name || <span style={{ color: 'var(--text-muted)' }}>—</span>
        )}
      </td>
      <td>
        {editing && !readOnly ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              className="form-input"
              value={localization.subtitle ?? ''}
              placeholder="Subtitle"
              style={{ flex: 1 }}
              onChange={(e) => localization.setSubtitle(e.target.value || null)}
            />
            <PluginSlot
              slot="text.edit"
              ctx={{
                slot: 'text.edit',
                kind: 'appInfo.subtitle',
                text: localization.subtitle ?? '',
                onChange: (v) => localization.setSubtitle(v || null),
                locale: localization.locale,
                maxLength: 30,
                appInfo,
                batch: subtitleBatch,
              }}
            />
          </div>
        ) : (
          localization.subtitle || <span style={{ color: 'var(--text-muted)' }}>—</span>
        )}
      </td>
      {!readOnly && (
      <td style={{ textAlign: 'right' }}>
        <div style={{ display: 'inline-flex', gap: 6 }}>
          {editing ? (
            <button type="button" className="btn btn-primary btn-sm" onClick={onDone}>Done</button>
          ) : (
            <button type="button" className="btn btn-secondary btn-sm" onClick={onEdit}>Edit</button>
          )}
          {onDelete && (
            <button type="button" className="btn btn-danger btn-sm" onClick={onDelete}>Delete</button>
          )}
        </div>
      </td>
      )}
    </tr>
  );
});

// ─── Privacy & Compliance ──────────────────────────────────────────

const PrivacyComplianceCard = observer(({ appInfo, readOnly }: { appInfo: AppInfo; readOnly: boolean }) => {
  return (
    <div className="card">
      <div className="toolbar">
        <div className="toolbar-left"><h3>Privacy & Compliance</h3></div>
      </div>
      <div className="card-body padded">
        <div className="form-group">
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <label className="form-label" htmlFor="pc-privacy">
              Privacy Policy URL <span style={{ color: '#dc2626' }}>*</span>
            </label>
            {!readOnly && (
              <PluginSlot
                slot="text.edit"
                ctx={{
                  slot: 'text.edit',
                  kind: 'appInfo.privacyPolicyUrl',
                  text: appInfo.privacyPolicyUrl ?? '',
                  onChange: (v) => appInfo.setPrivacyPolicyUrl(v || null),
                  locale: appInfo.primaryLocale,
                  appInfo,
                }}
              />
            )}
          </div>
          <input
            id="pc-privacy"
            className="form-input"
            placeholder="https://yourwebsite.com/privacy"
            value={appInfo.privacyPolicyUrl ?? ''}
            disabled={readOnly}
            onChange={(e) => appInfo.setPrivacyPolicyUrl(e.target.value || null)}
          />
          <div className="form-hint">Required · Apple rejects submissions without it.</div>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="pc-choices">Privacy Choices URL</label>
          <input
            id="pc-choices"
            className="form-input"
            placeholder="https://yourwebsite.com/privacy-choices"
            value={appInfo.privacyChoicesUrl ?? ''}
            disabled={readOnly}
            onChange={(e) => appInfo.setPrivacyChoicesUrl(e.target.value || null)}
          />
          <div className="form-hint">Optional · California opt-out URL.</div>
        </div>

        <div className="form-group">
          <label className="form-label">Age Rating</label>
          <AgeRatingCard appInfo={appInfo} disabled={readOnly} />
        </div>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Content Rights · Third-party Content Declaration</label>
          <RadioCard
            name="content-rights"
            selectedTone="blue"
            value={appInfo.contentRightsDeclaration}
            onChange={(id) => { if (!readOnly) appInfo.setContentRightsDeclaration(id); }}
            options={[
              {
                id: 'DOES_NOT_USE_THIRD_PARTY_CONTENT',
                title: 'No, it does not contain, show, or access third-party content',
                disabled: readOnly,
              },
              {
                id: 'USES_THIRD_PARTY_CONTENT',
                title: 'Yes, it contains, shows, or accesses third-party content, and I have the necessary rights',
                disabled: readOnly,
              },
            ]}
          />
        </div>
      </div>
    </div>
  );
});

// ─── Age rating card — opens the 7-step wizard on click. ─────────────

const AgeRatingCard = observer(function AgeRatingCard({
  appInfo, disabled,
}: { appInfo: AppInfo; disabled: boolean }) {
  const [wizardOpen, setWizardOpen] = useState(false);
  const rating = appInfo.appStoreAgeRating;
  const meta = (rating ? AGE_RATING_LABELS[rating] : undefined) ?? AGE_RATING_LABELS.UNRATED;
  return (
    <>
      <button
        type="button"
        className="age-rating-card"
        onClick={() => setWizardOpen(true)}
        disabled={disabled}
        style={{ opacity: disabled ? 0.6 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}
      >
        <span className="age-rating-badge">{meta.label}</span>
        <span className="age-rating-text">
          <span className="age-rating-title">
            {rating ? `Ages ${meta.label}` : 'No rating set'}
          </span>
          <span className="age-rating-sub">{meta.sub}</span>
        </span>
        <span className="age-rating-chevron" aria-hidden>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 6 15 12 9 18"/></svg>
        </span>
      </button>
      {wizardOpen && (
        <AgeRatingWizardSheet
          appInfo={appInfo}
          onClose={() => setWizardOpen(false)}
        />
      )}
    </>
  );
});

// ─── Sticky save bar ───────────────────────────────────────────────

const StickySaveBar = observer(({ appInfo }: { appInfo: AppInfo }) => {
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  if (!appInfo.hasUnsavedChanges && !saving) return null;

  const handleSave = async () => {
    setSaving(true);
    setMsg(null);
    try {
      await appInfo.save();
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
          <button type="button" className="btn btn-secondary" onClick={() => appInfo.discard()} disabled={saving}>
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

export default observer(AppInfoPage);
