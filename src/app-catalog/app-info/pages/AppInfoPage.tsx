import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useWorkspace } from '../../../workspace/ASCWorkspace.hooks.tsx';
import { useAppInfo } from '../AppInfo.hooks.ts';
import type { AppInfo } from '../AppInfo.ts';
import type { AppInfoLocalization } from '../AppInfoLocalization.ts';
import { RadioCard } from '../../../shared/components/RadioCard.tsx';
import { APP_CATEGORIES } from '../AppCategoryRegistry.ts';

// Human-friendly labels for Apple's age-rating api ids.
const AGE_RATING_LABELS: Record<string, { label: string; sub: string }> = {
  FOUR_PLUS:      { label: '4+',  sub: 'No objectionable content' },
  NINE_PLUS:      { label: '9+',  sub: 'Infrequent/mild content' },
  TWELVE_PLUS:    { label: '12+', sub: 'Frequent/intense content' },
  SEVENTEEN_PLUS: { label: '17+', sub: 'Mature content' },
  UNRATED:        { label: '—',   sub: 'Not yet rated' },
};

function AppInfoPage() {
  const workspace = useWorkspace();
  const currentApp = workspace?.currentApp ?? null;
  const selectedVersion = currentApp?.selectedVersion ?? null;
  const { appInfo, loading, error } = useAppInfo(
    currentApp?.id ?? null,
    selectedVersion?.state ?? null,
    currentApp?.primaryLocale ?? null,
  );

  if (!workspace?.hydrated) return <div className="spinner">Loading…</div>;

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

  if (loading) return <div className="spinner">Loading app info…</div>;

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

  return (
    <div className="app-info-wrap">
      <AppMetadataCard appInfo={appInfo} />
      <LocalizationsCard appInfo={appInfo} />
      <PrivacyComplianceCard appInfo={appInfo} />
      <StickySaveBar appInfo={appInfo} />
    </div>
  );
}

// ─── App Metadata ───────────────────────────────────────────────────

const AppMetadataCard = observer(({ appInfo }: { appInfo: AppInfo }) => {
  const primary = appInfo.localizationFor(appInfo.primaryLocale);

  return (
    <div className="card">
      <div className="toolbar">
        <div className="toolbar-left"><h3>App Metadata</h3></div>
      </div>
      <div className="card-body padded">
        <div className="form-group">
          <label className="form-label" htmlFor="am-name">App Name</label>
          <input
            id="am-name"
            className="form-input"
            value={primary?.name ?? ''}
            placeholder="My App"
            onChange={(e) => primary?.setName(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="am-subtitle">Subtitle</label>
          <input
            id="am-subtitle"
            className="form-input"
            value={primary?.subtitle ?? ''}
            placeholder="A short description"
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
              onChange={(e) => appInfo.setPrimaryCategory(e.target.value || null)}
            >
              <option value="">—</option>
              {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="am-category-2">Secondary Category</label>
            <select
              id="am-category-2"
              className="form-input select-styled"
              value={appInfo.secondaryCategoryId ?? ''}
              onChange={(e) => appInfo.setSecondaryCategory(e.target.value || null)}
            >
              <option value="">— None —</option>
              {CATEGORIES
                .filter((c) => c.id !== appInfo.primaryCategoryId)
                .map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
});

// ─── Localizations ──────────────────────────────────────────────────

const LocalizationsCard = observer(({ appInfo }: { appInfo: AppInfo }) => {
  const [editingLocale, setEditingLocale] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newLocale, setNewLocale] = useState('');

  const startAdd = () => { setAdding(true); setNewLocale(''); };
  const commitAdd = () => {
    const locale = newLocale.trim();
    if (!locale) return;
    try {
      appInfo.addLocalization(locale);
      setAdding(false);
      setNewLocale('');
      setEditingLocale(locale);
    } catch (err) {
      alert((err as Error).message);
    }
  };

  return (
    <div className="card">
      <div className="toolbar">
        <div className="toolbar-left"><h3>Localizations</h3></div>
        <div className="toolbar-right">
          <button type="button" className="btn btn-primary btn-sm" onClick={startAdd}>
            + Add Locale
          </button>
        </div>
      </div>

      {adding && (
        <div style={{
          display: 'flex', gap: 8, alignItems: 'center',
          padding: '12px 20px', borderBottom: '1px solid var(--border)',
          background: 'var(--bg-hover)',
        }}>
          <input
            className="form-input"
            style={{ maxWidth: 240 }}
            placeholder="Locale code (e.g. fr-FR)"
            value={newLocale}
            onChange={(e) => setNewLocale(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitAdd();
              else if (e.key === 'Escape') { setAdding(false); setNewLocale(''); }
            }}
            autoFocus
          />
          <button type="button" className="btn btn-primary btn-sm" onClick={commitAdd}>Add</button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setAdding(false); setNewLocale(''); }}>Cancel</button>
        </div>
      )}

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Locale</th>
              <th>Name</th>
              <th>Subtitle</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {appInfo.localizations.map((loc) => (
              <LocaleTableRow
                key={loc.locale}
                localization={loc}
                isPrimary={loc.locale === appInfo.primaryLocale}
                editing={editingLocale === loc.locale}
                onEdit={() => setEditingLocale(loc.locale)}
                onDone={() => setEditingLocale(null)}
                onDelete={
                  loc.locale !== appInfo.primaryLocale
                    ? () => {
                        if (!confirm(`Remove ${loc.locale}?`)) return;
                        appInfo.removeLocalization(loc.locale);
                        if (editingLocale === loc.locale) setEditingLocale(null);
                      }
                    : undefined
                }
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
});

interface LocaleRowProps {
  localization: AppInfoLocalization;
  isPrimary: boolean;
  editing: boolean;
  onEdit: () => void;
  onDone: () => void;
  onDelete?: () => void;
}

const LocaleTableRow = observer(({ localization, isPrimary, editing, onEdit, onDone, onDelete }: LocaleRowProps) => {
  return (
    <tr>
      <td className="cell-primary">
        {localization.locale}
        {isPrimary && (
          <span className="platform-badge" style={{ marginLeft: 8, fontSize: 9 }}>PRIMARY</span>
        )}
      </td>
      <td>
        {editing ? (
          <input
            className="form-input"
            value={localization.name}
            placeholder="Name"
            onChange={(e) => localization.setName(e.target.value)}
          />
        ) : (
          localization.name || <span style={{ color: 'var(--text-muted)' }}>—</span>
        )}
      </td>
      <td>
        {editing ? (
          <input
            className="form-input"
            value={localization.subtitle ?? ''}
            placeholder="Subtitle"
            onChange={(e) => localization.setSubtitle(e.target.value || null)}
          />
        ) : (
          localization.subtitle || <span style={{ color: 'var(--text-muted)' }}>—</span>
        )}
      </td>
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
    </tr>
  );
});

// ─── Privacy & Compliance ──────────────────────────────────────────

const PrivacyComplianceCard = observer(({ appInfo }: { appInfo: AppInfo }) => {
  return (
    <div className="card">
      <div className="toolbar">
        <div className="toolbar-left"><h3>Privacy & Compliance</h3></div>
      </div>
      <div className="card-body padded">
        <div className="form-group">
          <label className="form-label" htmlFor="pc-privacy">
            Privacy Policy URL <span style={{ color: '#dc2626' }}>*</span>
          </label>
          <input
            id="pc-privacy"
            className="form-input"
            placeholder="https://yourwebsite.com/privacy"
            value={appInfo.privacyPolicyUrl ?? ''}
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
            onChange={(e) => appInfo.setPrivacyChoicesUrl(e.target.value || null)}
          />
          <div className="form-hint">Optional · California opt-out URL.</div>
        </div>

        <div className="form-group">
          <label className="form-label">Age Rating</label>
          <button
            type="button"
            className="age-rating-card"
            onClick={() => alert('Age rating editor is not implemented yet — coming soon.')}
          >
            <span className="age-rating-badge">4+</span>
            <span className="age-rating-text">
              <span className="age-rating-title">Ages 4+ and Up</span>
              <span className="age-rating-sub">No objectionable content</span>
            </span>
            <span className="age-rating-chevron" aria-hidden>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 6 15 12 9 18"/></svg>
            </span>
          </button>
        </div>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Content Rights · Third-party Content Declaration</label>
          <RadioCard
            name="content-rights"
            selectedTone="blue"
            value={appInfo.contentRightsDeclaration}
            onChange={(id) => appInfo.setContentRightsDeclaration(id)}
            options={[
              {
                id: 'DOES_NOT_USE_THIRD_PARTY_CONTENT',
                title: 'No, it does not contain, show, or access third-party content',
              },
              {
                id: 'USES_THIRD_PARTY_CONTENT',
                title: 'Yes, it contains, shows, or accesses third-party content, and I have the necessary rights',
              },
            ]}
          />
        </div>
      </div>
    </div>
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
