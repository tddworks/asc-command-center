import { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import type { Subscription } from '../Subscription.ts';
import { SubscriptionPricePoint, SubscriptionPriceBucket } from '../SubscriptionPricePoint.ts';

interface Props {
  sub: Subscription;
  open: boolean;
  onClose: () => void;
}

const BUCKET_PILLS: { value: SubscriptionPriceBucket; label: string }[] = [
  { value: SubscriptionPriceBucket.All, label: 'All' },
  { value: SubscriptionPriceBucket.Under1, label: '<$1' },
  { value: SubscriptionPriceBucket.From1To10, label: '$1–$10' },
  { value: SubscriptionPriceBucket.From10To50, label: '$10–$50' },
  { value: SubscriptionPriceBucket.From50To100, label: '$50–$100' },
  { value: SubscriptionPriceBucket.Over100, label: '$100+' },
];

const PAGE_SIZE = 25;

/** Mirrors `IAPPricePointPickerModal`. Subscriptions don't have a "base
 *  territory" concept — anchor territory drives Apple's equalisation. */
function SubscriptionPricePointPickerModalImpl({ sub, open, onClose }: Props) {
  const [step, setStep] = useState<'pick' | 'preview'>('pick');
  const [territoryId, setTerritoryId] = useState('USA');
  const [bucket, setBucket] = useState<SubscriptionPriceBucket>(SubscriptionPriceBucket.All);
  const [query, setQuery] = useState('');

  const [items, setItems] = useState<SubscriptionPricePoint[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [picked, setPicked] = useState<SubscriptionPricePoint | null>(null);

  const [equalizations, setEqualizations] = useState<SubscriptionPricePoint[]>([]);
  const [eqLoading, setEqLoading] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setStep('pick');
    setTerritoryId('USA');
    setBucket(SubscriptionPriceBucket.All);
    setQuery('');
    setItems([]);
    setCursor(null);
    setPicked(null);
    setEqualizations([]);
    setError(null);
    setSubmitting(false);
  }, [open]);

  useEffect(() => {
    if (!open || step !== 'pick') return;
    let cancelled = false;
    setLoading(true);
    setItems([]);
    sub.loadPricePoints({ territoryId, cursor: null, limit: PAGE_SIZE })
      .then((page) => {
        if (cancelled) return;
        setItems(page.items);
        setCursor(page.nextCursor);
      })
      .catch((err) => { if (!cancelled) setError((err as Error).message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, step, territoryId, sub]);

  const loadMore = async () => {
    if (!cursor || loading) return;
    setLoading(true);
    try {
      const page = await sub.loadPricePoints({ territoryId, cursor, limit: PAGE_SIZE });
      setItems((prev) => [...prev, ...page.items]);
      setCursor(page.nextCursor);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const proceedToPreview = async (point: SubscriptionPricePoint) => {
    setPicked(point);
    setStep('preview');
    setEqualizations([]);
    setEqLoading(true);
    try {
      const all: SubscriptionPricePoint[] = [];
      let next: string | null = null;
      do {
        const page: { items: SubscriptionPricePoint[]; nextCursor: string | null } =
          await sub.loadEqualizations({ pricePointId: point.id, cursor: next, limit: 50 });
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
      await sub.setPrices([{ territoryId, pricePointId: picked.id }]);
      onClose();
    } catch (err) {
      setError((err as Error).message);
      setSubmitting(false);
    }
  };

  if (!open) return null;

  const visible = items
    .filter((p) => p.matchesBucket(bucket))
    .filter((p) => p.matches(query));

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
              ? `${sub.priceSchedule ? 'Change' : 'Set'} Price · ${sub.name}`
              : `Confirm Equalised Prices · ${picked?.formattedPrice}`}
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
              <label className="form-label" htmlFor="sub-picker-territory">Anchor Territory</label>
              <input
                id="sub-picker-territory"
                className="form-input"
                type="text"
                value={territoryId}
                onChange={(e) => setTerritoryId(e.target.value.toUpperCase())}
                placeholder="USA"
              />
              <div className="form-hint">Three-letter Apple territory code. Apple equalises every other territory off this one.</div>
            </div>

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {BUCKET_PILLS.map((b) => (
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
                  {equalizations.map((p) => (
                    <tr key={p.id}>
                      <td className="cell-mono">{p.territoryId}</td>
                      <td>{p.formattedPrice}</td>
                      <td className="muted">{p.proceeds || '—'}</td>
                    </tr>
                  ))}
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
                {submitting ? 'Saving…' : `Set Price · ${picked?.formattedPrice}`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export const SubscriptionPricePointPickerModal = observer(SubscriptionPricePointPickerModalImpl);
