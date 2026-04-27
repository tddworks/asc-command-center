import { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { territoryFlag } from '../../shared/territoryDirectory.ts';

/** Structural shape of a single tier returned by the backend's price-point
 *  catalog. Both `IAPPricePoint` and `SubscriptionPricePoint` already
 *  satisfy this. */
export interface PricePointLike {
  readonly id: string;
  readonly territoryId: string;
  readonly formattedPrice: string;
  readonly proceeds: string;
}

export interface PricePointPage<P extends PricePointLike> {
  items: P[];
  nextCursor: string | null;
}

/** Structural shape of the parent product the picker needs — paginated
 *  catalog + paginated equalizations. */
export interface PricePointPickingProduct<P extends PricePointLike> {
  loadPricePoints(input: { territoryId: string; cursor: string | null; limit?: number }): Promise<PricePointPage<P>>;
  loadEqualizations(input: { pricePointId: string; cursor: string | null; limit?: number }): Promise<PricePointPage<P>>;
}

export interface PricePointBucketPill {
  value: string;
  label: string;
}

export interface PricePointPickerConfig<P extends PricePointLike> {
  /** Title-bar context (`iap.referenceName` or `sub.name`). */
  productLabel: string;
  /** Toggles "Set" vs "Change" in the title. */
  hasExistingPrice: boolean;
  /** Initial territory the input renders with (IAP base or `'USA'`). */
  initialTerritoryId: string;
  /** Field label — IAP uses "Base Territory", subscriptions "Anchor Territory". */
  territoryFieldLabel: string;
  /** Bucket-filter pills the caller wants to expose. */
  buckets: PricePointBucketPill[];
  /** Initial bucket value. */
  defaultBucket: string;
  /** Caller-side bucket+query filter — keeps the modal free of domain enums. */
  filter(point: P, bucket: string, query: string): boolean;
  /** Confirm handler (`iap.setPrice` or `sub.setPrices`). */
  onConfirm(input: { territoryId: string; pricePointId: string }): Promise<void>;
}

interface Props<P extends PricePointLike> {
  product: PricePointPickingProduct<P>;
  config: PricePointPickerConfig<P>;
  open: boolean;
  onClose: () => void;
}

const PAGE_SIZE = 25;

/**
 * Shared two-step picker mirroring iOS's price-point picker. Step 1 picks
 * the territory + tier; Step 2 previews the equalised territory prices
 * before the user commits.
 */
function PricePointPickerModalImpl<P extends PricePointLike>({
  product,
  config,
  open,
  onClose,
}: Props<P>) {
  const [step, setStep] = useState<'pick' | 'preview'>('pick');
  const [territoryId, setTerritoryId] = useState(config.initialTerritoryId);
  const [bucket, setBucket] = useState<string>(config.defaultBucket);
  const [query, setQuery] = useState('');

  const [items, setItems] = useState<P[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [picked, setPicked] = useState<P | null>(null);

  const [equalizations, setEqualizations] = useState<P[]>([]);
  const [eqLoading, setEqLoading] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setStep('pick');
    setTerritoryId(config.initialTerritoryId);
    setBucket(config.defaultBucket);
    setQuery('');
    setItems([]);
    setCursor(null);
    setPicked(null);
    setEqualizations([]);
    setError(null);
    setSubmitting(false);
  }, [open, config.initialTerritoryId, config.defaultBucket]);

  // Load the first page whenever the picker opens or the territory changes.
  useEffect(() => {
    if (!open || step !== 'pick') return;
    let cancelled = false;
    setLoading(true);
    setItems([]);
    product.loadPricePoints({ territoryId, cursor: null, limit: PAGE_SIZE })
      .then((page) => {
        if (cancelled) return;
        setItems(page.items);
        setCursor(page.nextCursor);
      })
      .catch((err) => { if (!cancelled) setError((err as Error).message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, step, territoryId, product]);

  const loadMore = async () => {
    if (!cursor || loading) return;
    setLoading(true);
    try {
      const page = await product.loadPricePoints({ territoryId, cursor, limit: PAGE_SIZE });
      setItems((prev) => [...prev, ...page.items]);
      setCursor(page.nextCursor);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const proceedToPreview = async (point: P) => {
    setPicked(point);
    setStep('preview');
    setEqualizations([]);
    setEqLoading(true);
    try {
      const all: P[] = [];
      let next: string | null = null;
      do {
        const page: PricePointPage<P> =
          await product.loadEqualizations({ pricePointId: point.id, cursor: next, limit: 50 });
        all.push(...page.items);
        next = page.nextCursor;
      } while (next);
      setEqualizations(all);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setEqLoading(false);
    }
  };

  const confirm = async () => {
    if (!picked) return;
    setSubmitting(true);
    setError(null);
    try {
      await config.onConfirm({ territoryId, pricePointId: picked.id });
      onClose();
    } catch (err) {
      setError((err as Error).message);
      setSubmitting(false);
    }
  };

  if (!open) return null;

  const visible = items.filter((p) => config.filter(p, bucket, query));

  return (
    <div className="modal-overlay open" onClick={onClose}>
      <div
        className="modal"
        style={{ maxWidth: 640 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3>
            {step === 'pick'
              ? `${config.hasExistingPrice ? 'Change' : 'Set'} Price · ${config.productLabel}`
              : `Confirm Equalised Prices · ${picked?.formattedPrice ?? ''}`}
          </h3>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {step === 'pick' && (
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '60vh' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="picker-territory">{config.territoryFieldLabel}</label>
              <input
                id="picker-territory"
                className="form-input"
                type="text"
                value={territoryId}
                onChange={(e) => setTerritoryId(e.target.value.toUpperCase())}
                placeholder="USA"
              />
              <div className="form-hint">Three-letter Apple territory code. Apple equalises every other territory off this one.</div>
            </div>

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {config.buckets.map((b) => (
                <button
                  key={b.value}
                  type="button"
                  className={`btn btn-sm ${bucket === b.value ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setBucket(b.value)}
                >
                  {b.label}
                </button>
              ))}
            </div>

            <input
              type="search"
              className="form-input"
              placeholder="Search price or currency…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />

            <div style={{ overflow: 'auto', flex: 1, minHeight: 200 }}>
              {visible.length === 0 && !loading ? (
                <div className="muted" style={{ textAlign: 'center', padding: 16 }}>
                  No price points match the current filter.
                </div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Price</th>
                      <th>Proceeds</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((p) => (
                      <tr key={p.id}>
                        <td className="cell-primary">{p.formattedPrice}</td>
                        <td className="muted">{p.proceeds || '—'}</td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => proceedToPreview(p)}
                          >
                            Pick
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {cursor && (
                <div style={{ textAlign: 'center', padding: 8 }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={loadMore}
                    disabled={loading}
                  >
                    {loading ? 'Loading…' : 'Load more'}
                  </button>
                </div>
              )}
              {loading && items.length === 0 && (
                <div className="loading"><span className="spinner" /><span>Loading price points…</span></div>
              )}
            </div>

            {error && (
              <div className="form-hint" style={{ color: 'var(--danger-text)' }}>{error}</div>
            )}
          </div>
        )}

        {step === 'preview' && picked && (
          <div className="modal-body" style={{ maxHeight: '60vh', overflow: 'auto' }}>
            <div style={{ marginBottom: 12 }}>
              <strong>{territoryId}</strong> — {picked.formattedPrice} (proceeds {picked.proceeds || '—'})
            </div>
            {eqLoading ? (
              <div className="loading"><span className="spinner" /><span>Loading equalised prices…</span></div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Territory</th>
                    <th>Price</th>
                    <th>Proceeds</th>
                  </tr>
                </thead>
                <tbody>
                  {equalizations.map((p) => {
                    const flag = territoryFlag(p.territoryId);
                    return (
                      <tr key={p.id}>
                        <td className="cell-mono">
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            {flag && <span aria-hidden="true">{flag}</span>}
                            <span>{p.territoryId}</span>
                          </span>
                        </td>
                        <td>{p.formattedPrice}</td>
                        <td className="muted">{p.proceeds || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            {error && (
              <div className="form-hint" style={{ color: 'var(--danger-text)', marginTop: 8 }}>{error}</div>
            )}
          </div>
        )}

        <div className="modal-footer">
          {step === 'pick' ? (
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          ) : (
            <>
              <button type="button" className="btn btn-secondary" onClick={() => setStep('pick')} disabled={submitting}>
                Back
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={confirm}
                disabled={submitting || eqLoading}
              >
                {submitting ? 'Saving…' : `Set Price · ${picked?.formattedPrice ?? ''}`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export const PricePointPickerModal = observer(PricePointPickerModalImpl) as typeof PricePointPickerModalImpl;
