import { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import type { InAppPurchase } from '../InAppPurchase.ts';

interface Props {
  iap: InAppPurchase;
}

function IAPAvailabilityTabImpl({ iap }: Props) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'available' | 'unavailable'>('all');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (iap.isAvailabilityLoaded) return;
    void iap.loadAvailability().catch((err) => {
      console.warn('[iap] loadAvailability failed:', err);
    });
  }, [iap]);

  if (!iap.canViewAvailability) {
    return <div className="card-body"><span className="muted">Backend does not expose availability for this IAP.</span></div>;
  }
  if (!iap.isAvailabilityLoaded) {
    return <div className="loading"><span className="spinner" /><span>Loading availability…</span></div>;
  }

  const avail = iap.availability;
  if (!avail) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: 32 }}>
        <div style={{ fontSize: 32, opacity: 0.4 }}>🌍</div>
        <h4 style={{ marginTop: 8 }}>No availability resource yet</h4>
        <p className="muted" style={{ marginTop: 4 }}>Set a price first; Apple seeds availability after pricing is configured.</p>
      </div>
    );
  }

  const visible = avail.filtered(query).filter((t) => {
    if (filter === 'available') return t.isAvailable;
    if (filter === 'unavailable') return !t.isAvailable;
    return true;
  });

  const save = async () => {
    setSaving(true); setError(null);
    try { await iap.saveAvailability(); }
    catch (err) { setError((err as Error).message); }
    finally { setSaving(false); }
  };

  return (
    <div className="card">
      <div className="toolbar">
        <div className="toolbar-left">
          <h3>Availability</h3>
          <span className="muted" style={{ marginLeft: 8 }}>
            <strong>{avail.availableCount}</strong> of {avail.totalCount} territories available
          </span>
        </div>
        <div className="toolbar-right" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12 }}>
            <input
              type="checkbox"
              checked={avail.availableInNewTerritories}
              onChange={(e) => avail.setAvailableInNewTerritories(e.target.checked)}
            />
            <span>Auto-include new territories</span>
          </label>
          {avail.isDirty && !saving && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => avail.discard()}>
              Discard
            </button>
          )}
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={save}
            disabled={!avail.isDirty || saving || !iap.canSetAvailability}
            title={!iap.canSetAvailability ? 'Backend does not allow saving availability' : undefined}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      <div className="card-body" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="search"
          className="form-input"
          style={{ minWidth: 240, flex: '0 1 280px' }}
          placeholder="Search territories…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {(['all', 'available', 'unavailable'] as const).map((k) => (
          <button
            key={k}
            type="button"
            className={`btn btn-sm ${filter === k ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilter(k)}
          >
            {k === 'all' ? 'All' : k === 'available' ? 'Available' : 'Unavailable'}
          </button>
        ))}
        <span style={{ flex: 1 }} />
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => avail.setAllAvailable(true, (t) => visible.includes(t))}
          disabled={!iap.canSetAvailability}
        >
          Select visible
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => avail.setAllAvailable(false, (t) => visible.includes(t))}
          disabled={!iap.canSetAvailability}
        >
          Deselect visible
        </button>
      </div>

      {error && (
        <div className="card-body" style={{ paddingTop: 0 }}>
          <span className="form-hint" style={{ color: 'var(--danger-text)' }}>{error}</span>
        </div>
      )}

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th style={{ width: 40 }}></th>
              <th>Territory</th>
              <th>ID</th>
              <th>Currency</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr><td colSpan={4} className="muted" style={{ textAlign: 'center', padding: 16 }}>No matching territories.</td></tr>
            ) : visible.map((t) => (
              <tr key={t.territoryId}>
                <td>
                  <input
                    type="checkbox"
                    checked={t.isAvailable}
                    onChange={() => avail.toggleTerritory(t.territoryId)}
                    disabled={!iap.canSetAvailability}
                  />
                </td>
                <td className="cell-primary">{t.territoryName}</td>
                <td className="cell-mono">{t.territoryId}</td>
                <td>{t.currency}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export const IAPAvailabilityTab = observer(IAPAvailabilityTabImpl);
