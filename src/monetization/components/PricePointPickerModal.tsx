import { useEffect, useMemo, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { listTerritories, territoryFlag, territoryName } from '../../shared/territoryDirectory.ts';

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
 *  catalog of price points for the chosen territory. The legacy
 *  `loadEqualizations` is no longer used here (iOS commits without
 *  previewing — the server equalises on `setPrice`). */
export interface PricePointPickingProduct<P extends PricePointLike> {
  loadPricePoints(input: { territoryId: string; cursor: string | null; limit?: number }): Promise<PricePointPage<P>>;
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
  /** Initial territory the list highlights (IAP base or `'USA'`). */
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

const PAGE_SIZE = 200;

/**
 * Two-step pricing picker mirroring `IAPSetBasePriceSheet` from iOS:
 *
 *   Step 1 — Select Base Territory: searchable territory list, single-tap
 *            selection, "Next: Set Price" advances to step 2.
 *   Step 2 — Pick Price Tier: territory header + Change link, search +
 *            bucket pills, scrollable price-point cards (single-select),
 *            "Set Price · {price}" CTA commits.
 *
 * The previous "preview equalisations" step is dropped — Apple equalises
 * server-side on commit, matching the iOS flow.
 */
function PricePointPickerModalImpl<P extends PricePointLike>({
  product,
  config,
  open,
  onClose,
}: Props<P>) {
  const [step, setStep] = useState<'territory' | 'price'>('territory');

  // Territory step
  const [territoryId, setTerritoryId] = useState(config.initialTerritoryId);
  const [territoryQuery, setTerritoryQuery] = useState('');

  // Price step
  const [items, setItems] = useState<P[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [bucket, setBucket] = useState<string>(config.defaultBucket);
  const [priceQuery, setPriceQuery] = useState('');
  const [pickedId, setPickedId] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setStep('territory');
    setTerritoryId(config.initialTerritoryId);
    setTerritoryQuery('');
    setItems([]);
    setCursor(null);
    setBucket(config.defaultBucket);
    setPriceQuery('');
    setPickedId(null);
    setError(null);
    setSubmitting(false);
  }, [open, config.initialTerritoryId, config.defaultBucket]);

  // Load price points whenever step 2 opens or the chosen territory changes.
  // Eager-paginates after the first page so the bucket filter pills (which
  // partition the loaded set numerically) see the whole catalog — otherwise
  // a filter like "$50–$100" can show "0 tiers" simply because the matching
  // tiers happened to land on a later page.
  useEffect(() => {
    if (!open || step !== 'price') return;
    let cancelled = false;
    setLoading(true);
    setItems([]);
    setCursor(null);
    setPickedId(null);

    (async () => {
      try {
        let next: string | null = null;
        let firstPage = true;
        do {
          const page = await product.loadPricePoints({ territoryId, cursor: next, limit: PAGE_SIZE });
          if (cancelled) return;
          setItems((prev) => (firstPage ? page.items : [...prev, ...page.items]));
          setCursor(page.nextCursor);
          next = page.nextCursor;
          firstPage = false;
          // Show the first page immediately; remaining pages append in the
          // background while the user is already browsing.
          if (firstPage === false) setLoading(false);
        } while (next);
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [open, step, territoryId, product]);

  const territories = useMemo(() => listTerritories(), []);
  const filteredTerritories = useMemo(() => {
    const q = territoryQuery.trim().toLowerCase();
    if (!q) return territories;
    return territories.filter(
      (t) => t.name.toLowerCase().includes(q) || t.id.toLowerCase().includes(q),
    );
  }, [territories, territoryQuery]);

  const visiblePrices = items.filter((p) => config.filter(p, bucket, priceQuery));
  const picked = items.find((p) => p.id === pickedId) ?? null;

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

  const titleVerb = config.hasExistingPrice ? 'Change' : 'Set';

  return (
    <div className="modal-overlay open" onClick={onClose}>
      <div
        className="modal"
        style={{ maxWidth: 560, width: '100%' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3>
            {step === 'territory'
              ? `${titleVerb} Price · ${config.productLabel}`
              : `Select Price · ${territoryName(territoryId)}`}
          </h3>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {step === 'territory' && (
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: '60vh' }}>
            <div className="form-hint" style={{ marginTop: 0 }}>
              Pick a {config.territoryFieldLabel.toLowerCase()}. Apple equalises every other territory off this one.
            </div>

            <input
              type="search"
              className="form-input"
              placeholder="Search territories…"
              value={territoryQuery}
              onChange={(e) => setTerritoryQuery(e.target.value)}
            />

            <div style={{ overflow: 'auto', flex: 1, minHeight: 240, border: '1px solid var(--border)', borderRadius: 8 }}>
              {filteredTerritories.length === 0 ? (
                <div className="muted" style={{ textAlign: 'center', padding: 16 }}>
                  No matching territories.
                </div>
              ) : (
                <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {filteredTerritories.map((t, idx) => {
                    const selected = t.id === territoryId;
                    return (
                      <li key={t.id}>
                        <button
                          type="button"
                          onClick={() => setTerritoryId(t.id)}
                          style={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            padding: '10px 14px',
                            background: selected ? 'var(--accent-light, rgba(0,122,255,0.08))' : 'transparent',
                            border: 'none',
                            borderTop: idx === 0 ? 'none' : '1px solid var(--border)',
                            cursor: 'pointer',
                            textAlign: 'left',
                            color: 'inherit',
                          }}
                        >
                          <span aria-hidden="true" style={{ fontSize: 20, lineHeight: 1 }}>{t.flag}</span>
                          <span style={{ flex: 1, fontWeight: selected ? 600 : 500 }}>{t.name}</span>
                          <span className="muted" style={{ fontSize: 11, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>{t.id}</span>
                          {selected && (
                            <span style={{ color: 'var(--accent-text, var(--accent))', fontWeight: 700 }}>✓</span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {error && (
              <div className="form-hint" style={{ color: 'var(--danger-text)' }}>{error}</div>
            )}
          </div>
        )}

        {step === 'price' && (
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: '60vh' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 12px',
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: 8,
              }}
            >
              <span aria-hidden="true" style={{ fontSize: 20 }}>{territoryFlag(territoryId)}</span>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <strong style={{ fontSize: 14 }}>{territoryName(territoryId)}</strong>
                <span className="muted" style={{ fontSize: 12 }}>Select a price tier</span>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setStep('territory')}
                disabled={submitting}
              >
                Change
              </button>
            </div>

            <input
              type="search"
              className="form-input"
              placeholder="Search price tier…"
              value={priceQuery}
              onChange={(e) => setPriceQuery(e.target.value)}
            />

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

            <div className="muted" style={{ fontSize: 11 }}>
              {visiblePrices.length} price {visiblePrices.length === 1 ? 'tier' : 'tiers'}
              {cursor && ' (loading more…)'}
            </div>

            <div style={{ overflow: 'auto', flex: 1, minHeight: 200 }}>
              {loading && items.length === 0 ? (
                <div className="loading"><span className="spinner" /><span>Loading price tiers…</span></div>
              ) : visiblePrices.length === 0 ? (
                <div className="muted" style={{ textAlign: 'center', padding: 16 }}>
                  No price tiers match the current filter.
                </div>
              ) : (
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {visiblePrices.map((p) => {
                    const selected = p.id === pickedId;
                    return (
                      <li key={p.id}>
                        <button
                          type="button"
                          onClick={() => setPickedId(p.id)}
                          style={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '12px 14px',
                            background: selected ? 'var(--accent-light, rgba(0,122,255,0.08))' : 'var(--bg)',
                            border: selected
                              ? '1.5px solid var(--accent, #007aff)'
                              : '1px solid var(--border)',
                            borderRadius: 10,
                            cursor: 'pointer',
                            color: 'inherit',
                          }}
                        >
                          <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                            <strong style={{ fontSize: 15 }}>{p.formattedPrice}</strong>
                            {p.proceeds && (
                              <span className="muted" style={{ fontSize: 11 }}>Proceeds {p.proceeds}</span>
                            )}
                          </span>
                          {selected && (
                            <span style={{ color: 'var(--accent-text, var(--accent))', fontWeight: 700 }}>✓</span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}

            </div>

            {error && (
              <div className="form-hint" style={{ color: 'var(--danger-text)' }}>{error}</div>
            )}
          </div>
        )}

        <div className="modal-footer">
          {step === 'territory' ? (
            <>
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setStep('price')}
                disabled={!territoryId}
              >
                Next: Set Price
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setStep('territory')}
                disabled={submitting}
              >
                Back
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={confirm}
                disabled={submitting || !picked}
              >
                {submitting ? 'Saving…' : `Set Price${picked ? ` · ${picked.formattedPrice}` : ''}`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export const PricePointPickerModal = observer(PricePointPickerModalImpl) as typeof PricePointPickerModalImpl;
