import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useWorkspace } from '../../../workspace/ASCWorkspace.hooks.tsx';
import { useAppInfo } from '../AppInfo.hooks.ts';
import type { AppInfo } from '../AppInfo.ts';
import type { AppInfoLocalization } from '../AppInfoLocalization.ts';

// Placeholder category list — swap to a real `/app-categories` fetch once the
// category-registry slice is in place (see Known limitations in app-info.md).
const CATEGORIES: Array<{ id: string; label: string }> = [
  { id: 'WEATHER', label: 'Weather' },
  { id: 'HEALTH_AND_FITNESS', label: 'Health & Fitness' },
  { id: 'PRODUCTIVITY', label: 'Productivity' },
  { id: 'UTILITIES', label: 'Utilities' },
  { id: 'FOOD_AND_DRINK', label: 'Food & Drink' },
  { id: 'SPORTS', label: 'Sports' },
  { id: 'DEVELOPER_TOOLS', label: 'Developer Tools' },
  { id: 'BUSINESS', label: 'Business' },
  { id: 'PHOTOGRAPHY', label: 'Photography' },
];

function AppInfoPage() {
  const workspace = useWorkspace();
  const currentApp = workspace?.currentApp ?? null;
  const { appInfo, loading, error } = useAppInfo(currentApp?.id ?? null);

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
    <div>
      <AppMetadataCard appInfo={appInfo} />
      <div style={{ height: 16 }} />
      <LocalizationsCard appInfo={appInfo} />
    </div>
  );
}

// ─── App Metadata card ─────────────────────────────────────────────

const AppMetadataCard = observer(({ appInfo }: { appInfo: AppInfo }) => {
  const primary = appInfo.localizationFor(appInfo.primaryLocale);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setSaveMsg(null);
    try {
      await appInfo.save();
      setSaveMsg({ kind: 'ok', text: 'Saved' });
      setTimeout(() => setSaveMsg(null), 2000);
    } catch (err) {
      setSaveMsg({ kind: 'error', text: (err as Error).message });
    } finally {
      setSaving(false);
    }
  };

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

        <div className="form-row">
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
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="am-privacy">Privacy Policy URL</label>
          <input
            id="am-privacy"
            className="form-input"
            value={appInfo.privacyPolicyUrl ?? ''}
            placeholder="https://example.com/privacy"
            onChange={(e) => appInfo.setPrivacyPolicyUrl(e.target.value || null)}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSave}
            disabled={!appInfo.hasUnsavedChanges || saving}
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
          {saveMsg && (
            <span style={{
              fontSize: 12,
              color: saveMsg.kind === 'ok' ? 'var(--success-text)' : 'var(--danger-text)',
              fontWeight: 500,
            }}>
              {saveMsg.text}
            </span>
          )}
        </div>
      </div>
    </div>
  );
});

// ─── Localizations card ────────────────────────────────────────────

const LocalizationsCard = observer(({ appInfo }: { appInfo: AppInfo }) => {
  const [editingLocale, setEditingLocale] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newLocale, setNewLocale] = useState('');

  const startAdd = () => { setAdding(true); setNewLocale(''); };
  const cancelAdd = () => { setAdding(false); setNewLocale(''); };
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
            style={{ maxWidth: 220 }}
            placeholder="Locale code (e.g. fr-FR)"
            value={newLocale}
            onChange={(e) => setNewLocale(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitAdd();
              else if (e.key === 'Escape') cancelAdd();
            }}
            autoFocus
          />
          <button type="button" className="btn btn-primary btn-sm" onClick={commitAdd}>Add</button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={cancelAdd}>Cancel</button>
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

// ─── One locale row (read-only or inline-editable) ──────────────────

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

export default observer(AppInfoPage);
