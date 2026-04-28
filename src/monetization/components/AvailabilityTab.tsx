import { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import type {
  AvailabilityConfig,
  AvailabilityLike,
  ProductWithAvailability,
  TerritoryAvailabilityLike,
} from './LocalizableProduct.ts';
import { territoryFlag, territoryName } from '../../shared/territoryDirectory.ts';

interface Props<
  T extends TerritoryAvailabilityLike,
  A extends AvailabilityLike<T>,
  P extends ProductWithAvailability<T, A>,
> {
  product: P;
  config: AvailabilityConfig;
}

/**
 * Shared Availability tab for IAP + Subscription tier. Three rows:
 *
 *   1. Title + count summary
 *   2. Auto-include setting + Save / Discard
 *   3. Search + filter pills + Select/Deselect-visible
 *
 * Then the territory table.
 */
function AvailabilityTabImpl<
  T extends TerritoryAvailabilityLike,
  A extends AvailabilityLike<T>,
  P extends ProductWithAvailability<T, A>,
>({ product, config }: Props<T, A, P>) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'available' | 'unavailable'>('all');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (product.isAvailabilityLoaded) return;
    void product.loadAvailability().catch((err) => {
      console.warn('[availability] load failed:', err);
    });
  }, [product]);

  if (!product.canViewAvailability) {
    return <div className="card-body padded"><span className="muted">Backend does not expose availability for this {config.productKind.toLowerCase()}.</span></div>;
  }
  if (!product.isAvailabilityLoaded) {
    return <div className="loading"><span className="spinner" /><span>Loading availability…</span></div>;
  }

  const avail = product.availability;
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
  const isFiltering = query.trim().length > 0 || filter !== 'all';

  const save = async () => {
    setSaving(true); setError(null);
    try { await product.saveAvailability(); }
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
      </div>

      <div
        className="card-body padded"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          flexWrap: 'wrap',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={avail.availableInNewTerritories}
            onChange={(e) => avail.setAvailableInNewTerritories(e.target.checked)}
            style={{ width: 16, height: 16 }}
          />
          <span>
            <span style={{ fontWeight: 500 }}>Auto-include new territories</span>
            <span className="form-hint" style={{ marginLeft: 8 }}>
              Apple will include this {config.productKind.toLowerCase()} automatically when a new territory is added.
            </span>
          </span>
        </label>
        <span style={{ flex: 1 }} />
        {avail.isDirty && (
          <span className="muted" style={{ fontSize: 12 }}>Pending changes</span>
        )}
        {avail.isDirty && !saving && (
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => avail.discard()}>
            Discard
          </button>
        )}
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={save}
          disabled={!avail.isDirty || saving || !product.canSetAvailability}
          title={!product.canSetAvailability ? 'Backend does not allow saving availability' : undefined}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>

      <div
        className="card-body padded"
        style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}
      >
        <input
          type="search"
          className="form-input"
          style={{ minWidth: 180, flex: '0 1 280px' }}
          placeholder="Search territories…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div style={{ display: 'inline-flex', gap: 6 }}>
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
        </div>
        <span style={{ flex: 1 }} />
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => avail.setAllAvailable(true)}
          disabled={!product.canSetAvailability || avail.availableCount === avail.totalCount}
        >
          Select all ({avail.totalCount})
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => avail.setAllAvailable(false)}
          disabled={!product.canSetAvailability || avail.availableCount === 0}
        >
          Deselect all
        </button>
        {isFiltering && (
          <>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => avail.setAllAvailable(true, (t) => visible.includes(t))}
              disabled={!product.canSetAvailability || visible.length === 0}
              title="Select only the territories matching the current search/filter"
            >
              Select visible ({visible.length})
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => avail.setAllAvailable(false, (t) => visible.includes(t))}
              disabled={!product.canSetAvailability || visible.length === 0}
              title="Deselect only the territories matching the current search/filter"
            >
              Deselect visible ({visible.length})
            </button>
          </>
        )}
      </div>

      {error && (
        <div className="card-body padded" style={{ paddingTop: 0 }}>
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
            ) : visible.map((t) => {
              const flag = territoryFlag(t.territoryId);
              const directoryName = territoryName(t.territoryId);
              const displayName =
                directoryName !== t.territoryId
                  ? directoryName
                  : (t.territoryName && t.territoryName !== t.territoryId)
                    ? t.territoryName
                    : directoryName;
              return (
                <tr key={t.territoryId}>
                  <td>
                    <input
                      type="checkbox"
                      checked={t.isAvailable}
                      onChange={() => avail.toggleTerritory(t.territoryId)}
                      disabled={!product.canSetAvailability}
                    />
                  </td>
                  <td className="cell-primary">
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      {flag && (
                        <span aria-hidden="true" style={{ fontSize: 18, lineHeight: 1 }}>{flag}</span>
                      )}
                      <span>{displayName}</span>
                    </span>
                  </td>
                  <td className="cell-mono">{t.territoryId}</td>
                  <td>{t.currency}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export const AvailabilityTab = observer(AvailabilityTabImpl) as typeof AvailabilityTabImpl;
