import { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import {
  SUBSCRIPTION_GROUP_NAME_LIMIT,
  SUBSCRIPTION_GROUP_CUSTOM_APP_NAME_LIMIT,
  type SubscriptionGroupLocalization,
} from '../SubscriptionGroupLocalization.ts';
import type { SubscriptionGroup } from '../SubscriptionGroup.ts';
import {
  APP_STORE_LOCALES,
  localeDisplayName,
} from '../../../shared/AppStoreLocaleRegistry.ts';

interface Props {
  group: SubscriptionGroup;
}

function LocaleCard({ group, loc }: { group: SubscriptionGroup; loc: SubscriptionGroupLocalization }) {
  const [busy, setBusy] = useState<'save' | 'delete' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setBusy('save'); setError(null);
    try { await loc.save(); }
    catch (err) { setError((err as Error).message); }
    finally { setBusy(null); }
  };
  const remove = async () => {
    if (!loc.canDelete) return;
    if (!window.confirm(`Remove ${localeDisplayName(loc.locale)} group localization?`)) return;
    setBusy('delete'); setError(null);
    try { await group.removeGroupLocalization(loc); }
    catch (err) { setError((err as Error).message); setBusy(null); }
  };

  const nameOver = loc.nameRemaining < 0;
  const customOver = loc.customAppNameRemaining < 0;

  return (
    <div className="card" style={{ marginBottom: 8 }}>
      <div className="toolbar">
        <div className="toolbar-left">
          <strong>{localeDisplayName(loc.locale)}</strong>
          <span className="muted" style={{ marginLeft: 8, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
            {loc.locale}
          </span>
          {!loc.isComplete && (
            <span className="status pending" style={{ marginLeft: 8 }}>Incomplete</span>
          )}
        </div>
        <div className="toolbar-right" style={{ display: 'flex', gap: 6 }}>
          {loc.hasUnsavedChanges && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => loc.discard()} disabled={!!busy}>
              Discard
            </button>
          )}
          {loc.canDelete && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={remove} disabled={!!busy}>
              {busy === 'delete' ? 'Removing…' : 'Remove'}
            </button>
          )}
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={save}
            disabled={!loc.hasUnsavedChanges || nameOver || customOver || !!busy || !loc.canUpdate}
          >
            {busy === 'save' ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
      <div className="card-body">
        <div className="form-group">
          <label className="form-label">
            Group Display Name
            <span className="form-hint" style={{ marginLeft: 8, color: nameOver ? 'var(--danger-text)' : undefined }}>
              {(loc.name?.length ?? 0)}/{SUBSCRIPTION_GROUP_NAME_LIMIT}
            </span>
          </label>
          <input
            className="form-input"
            type="text"
            value={loc.name}
            onChange={(e) => loc.setName(e.target.value)}
            placeholder="e.g. Premium Plans"
          />
        </div>

        <div className="form-group">
          <label className="form-label">
            Custom App Name
            <span className="form-hint" style={{ marginLeft: 8, color: customOver ? 'var(--danger-text)' : undefined }}>
              {(loc.customAppName?.length ?? 0)}/{SUBSCRIPTION_GROUP_CUSTOM_APP_NAME_LIMIT}
            </span>
          </label>
          <input
            className="form-input"
            type="text"
            value={loc.customAppName ?? ''}
            onChange={(e) => loc.setCustomAppName(e.target.value || null)}
            placeholder="Override the bundle name in the device subscription UI"
          />
        </div>

        {error && (
          <div className="form-hint" style={{ color: 'var(--danger-text)' }}>{error}</div>
        )}
      </div>
    </div>
  );
}

const ObservedLocaleCard = observer(LocaleCard);

function AddLocalePanel({ group, onClose }: { group: SubscriptionGroup; onClose: () => void }) {
  const taken = new Set(group.groupLocalizations.map((l) => l.locale));
  const available = APP_STORE_LOCALES.filter((l) => !taken.has(l.code));

  const [locale, setLocale] = useState(available[0]?.code ?? '');
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = name.trim();
  const nameOver = name.length > SUBSCRIPTION_GROUP_NAME_LIMIT;
  const canSubmit = !!locale && !!trimmed && !nameOver && !submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true); setError(null);
    try {
      await group.addGroupLocalization({ locale, name: trimmed });
      onClose();
    } catch (err) { setError((err as Error).message); setSubmitting(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="card" style={{ marginBottom: 8, borderStyle: 'dashed' }}>
      <div className="card-body" style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div className="form-group" style={{ marginBottom: 0, minWidth: 200 }}>
          <label className="form-label">Language</label>
          <select className="form-input" value={locale} onChange={(e) => setLocale(e.target.value)}>
            {available.map((l) => (
              <option key={l.code} value={l.code}>{l.displayName} ({l.code})</option>
            ))}
          </select>
        </div>
        <div className="form-group" style={{ marginBottom: 0, flex: 1, minWidth: 200 }}>
          <label className="form-label">
            Display Name
            <span className="form-hint" style={{ marginLeft: 8, color: nameOver ? 'var(--danger-text)' : undefined }}>
              {name.length}/{SUBSCRIPTION_GROUP_NAME_LIMIT}
            </span>
          </label>
          <input
            className="form-input"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={localeDisplayName(locale)}
          />
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary btn-sm" disabled={!canSubmit}>
            {submitting ? 'Adding…' : 'Add'}
          </button>
        </div>
      </div>
      {error && (
        <div className="card-body" style={{ paddingTop: 0 }}>
          <span className="form-hint" style={{ color: 'var(--danger-text)' }}>{error}</span>
        </div>
      )}
    </form>
  );
}

const ObservedAddLocalePanel = observer(AddLocalePanel);

function GroupLocalizationsPanelImpl({ group }: Props) {
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (group.isGroupLocalizationsLoaded) return;
    void group.loadGroupLocalizations().catch((err) => {
      console.warn('[group] loadGroupLocalizations failed:', err);
    });
  }, [group]);

  if (!group.canViewGroupLocalizations) {
    return <div className="card-body"><span className="muted">This backend does not expose group localizations.</span></div>;
  }
  if (!group.isGroupLocalizationsLoaded) {
    return <div className="loading"><span className="spinner" /><span>Loading group localizations…</span></div>;
  }

  return (
    <div style={{ padding: '0 16px 16px' }}>
      {group.groupLocalizations.length === 0 ? (
        <div className="card-body" style={{ textAlign: 'center', padding: 16 }}>
          <span className="muted">No group localizations yet.</span>
        </div>
      ) : (
        group.groupLocalizations.map((loc) => (
          <ObservedLocaleCard key={loc.locale} group={group} loc={loc} />
        ))
      )}

      {adding ? (
        <ObservedAddLocalePanel group={group} onClose={() => setAdding(false)} />
      ) : group.canCreateGroupLocalization ? (
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => setAdding(true)}
        >
          + Add Language
        </button>
      ) : null}
    </div>
  );
}

export const GroupLocalizationsPanel = observer(GroupLocalizationsPanelImpl);
