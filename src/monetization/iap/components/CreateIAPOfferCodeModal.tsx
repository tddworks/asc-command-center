import { useEffect, useMemo, useState } from 'react';
import { observer } from 'mobx-react-lite';
import type { InAppPurchase } from '../InAppPurchase.ts';
import { IAPCustomerEligibility, type OfferCodePriceInput } from '../InAppPurchaseOfferCode.ts';
import { PriceBucket, type IAPPricePoint } from '../IAPPricePoint.ts';
import {
  PricePointPickerModal,
  type PricePointBucketPill,
} from '../../components/PricePointPickerModal.tsx';

interface Props {
  iap: InAppPurchase;
  open: boolean;
  onClose: () => void;
}

const ELIGIBILITY_OPTIONS: { value: IAPCustomerEligibility; label: string; subtitle: string }[] = [
  { value: IAPCustomerEligibility.NonSpender, label: 'New customers', subtitle: 'Have not bought yet' },
  { value: IAPCustomerEligibility.ActiveSpender, label: 'Active spenders', subtitle: 'Currently spending' },
  { value: IAPCustomerEligibility.ChurnedSpender, label: 'Churned spenders', subtitle: 'Previously spent, now lapsed' },
];

const BUCKETS: PricePointBucketPill[] = [
  { value: PriceBucket.All, label: 'All' },
  { value: PriceBucket.Under1, label: '<$1' },
  { value: PriceBucket.From1To10, label: '$1–$10' },
  { value: PriceBucket.From10To50, label: '$10–$50' },
  { value: PriceBucket.From50To100, label: '$50–$100' },
  { value: PriceBucket.Over100, label: '$100+' },
];

const STEPS = [
  { id: 'name', title: 'Name & eligibility' },
  { id: 'territories', title: 'Territories' },
  { id: 'pricing', title: 'Pricing' },
  { id: 'confirm', title: 'Confirm' },
] as const;

type StepId = typeof STEPS[number]['id'];

const MAX_NAME_LENGTH = 60;

/**
 * 4-step wizard mirroring iOS's `iOSIAPCreateOfferCodeSheet`:
 *
 *   1. Name + customer eligibility
 *   2. Territories (multi-select; defaults to all available)
 *   3. Free toggle, or pick a base territory + price point for paid offers
 *   4. Confirm summary
 *
 * Forwards a `prices` array to `iap.createOfferCode`. Free offers send
 * `pricePointId: null` for every selected territory; paid offers send the
 * picked `pricePointId` for the chosen territory and `null` for the rest
 * (so backend equalisation kicks in).
 */
function CreateIAPOfferCodeModalImpl({ iap, open, onClose }: Props) {
  const [step, setStep] = useState<StepId>('name');

  // Step 1
  const [name, setName] = useState('');
  const [eligibilities, setEligibilities] = useState<IAPCustomerEligibility[]>([
    IAPCustomerEligibility.NonSpender,
  ]);

  // Step 2
  const [selectedTerritories, setSelectedTerritories] = useState<Set<string>>(new Set());
  const [territoryQuery, setTerritoryQuery] = useState('');
  const [isLoadingAvailability, setIsLoadingAvailability] = useState(false);

  // Step 3
  const [isFree, setIsFree] = useState(true);
  const [paidTerritoryId, setPaidTerritoryId] = useState<string>('USA');
  const [paidPricePointId, setPaidPricePointId] = useState<string | null>(null);
  const [paidPricePointLabel, setPaidPricePointLabel] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Step 4
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setStep('name');
    setName('');
    setEligibilities([IAPCustomerEligibility.NonSpender]);
    setSelectedTerritories(new Set());
    setTerritoryQuery('');
    setIsFree(true);
    setPaidTerritoryId('USA');
    setPaidPricePointId(null);
    setPaidPricePointLabel(null);
    setPickerOpen(false);
    setSubmitting(false);
    setError(null);

    // Lazily ensure availability is loaded so step 2 has territories.
    let cancelled = false;
    void (async () => {
      if (iap.isAvailabilityLoaded && iap.availability) return;
      setIsLoadingAvailability(true);
      try {
        await iap.loadAvailability();
      } catch (err) {
        console.warn('[iap-offer-code] loadAvailability failed:', err);
      } finally {
        if (!cancelled) setIsLoadingAvailability(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, iap]);

  // Pre-select all available territories the first time availability lands.
  useEffect(() => {
    if (!open) return;
    if (selectedTerritories.size > 0) return;
    const list = iap.availability?.territories.filter((t) => t.isAvailable) ?? [];
    if (list.length === 0) return;
    setSelectedTerritories(new Set(list.map((t) => t.territoryId)));
  }, [open, iap.availability, iap.isAvailabilityLoaded, selectedTerritories.size]);

  if (!open) return null;

  const trimmed = name.trim();
  const stepIndex = STEPS.findIndex((s) => s.id === step);

  const availableTerritories = useMemo(
    () => iap.availability?.territories.filter((t) => t.isAvailable) ?? [],
    [iap.availability],
  );

  const filteredTerritories = useMemo(() => {
    const q = territoryQuery.trim().toLowerCase();
    if (!q) return availableTerritories;
    return availableTerritories.filter(
      (t) =>
        t.territoryName.toLowerCase().includes(q) ||
        t.territoryId.toLowerCase().includes(q) ||
        t.currency.toLowerCase().includes(q),
    );
  }, [availableTerritories, territoryQuery]);

  const canAdvance =
    step === 'name'
      ? !!trimmed && eligibilities.length > 0
      : step === 'territories'
        ? selectedTerritories.size > 0
        : step === 'pricing'
          ? isFree || paidPricePointId !== null
          : true;

  const advance = () => {
    if (step === 'confirm') {
      void create();
      return;
    }
    const next = STEPS[stepIndex + 1];
    if (next) setStep(next.id);
  };

  const goBack = () => {
    const prev = STEPS[stepIndex - 1];
    if (prev) setStep(prev.id);
  };

  const toggleEligibility = (value: IAPCustomerEligibility) => {
    setEligibilities((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );
  };

  const toggleTerritory = (id: string) => {
    setSelectedTerritories((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllVisible = () => {
    setSelectedTerritories((prev) => {
      const next = new Set(prev);
      for (const t of filteredTerritories) next.add(t.territoryId);
      return next;
    });
  };

  const clearVisible = () => {
    setSelectedTerritories((prev) => {
      const next = new Set(prev);
      for (const t of filteredTerritories) next.delete(t.territoryId);
      return next;
    });
  };

  const buildPrices = (): OfferCodePriceInput[] => {
    const territories = Array.from(selectedTerritories);
    if (isFree) {
      return territories.map((territory) => ({ territory, pricePointId: null }));
    }
    return territories.map((territory) => ({
      territory,
      pricePointId: territory === paidTerritoryId ? paidPricePointId : null,
    }));
  };

  const create = async () => {
    if (submitting) return;
    setSubmitting(true); setError(null);
    try {
      await iap.createOfferCode({
        name: trimmed,
        customerEligibilities: eligibilities,
        prices: buildPrices(),
      });
      onClose();
    } catch (err) {
      setError((err as Error).message);
      setSubmitting(false);
    }
  };

  // ── Step 1 ──
  const step1 = (
    <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="form-group">
        <label className="form-label" htmlFor="oc-name">Reference Name *</label>
        <input
          id="oc-name"
          className="form-input"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, MAX_NAME_LENGTH))}
          placeholder="e.g. WELCOME20"
          autoFocus
        />
        <div className="form-hint" style={{ textAlign: 'right' }}>
          {MAX_NAME_LENGTH - name.length} characters left
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Customer Eligibility *</label>
        <div className="form-hint" style={{ marginBottom: 8 }}>
          Pick at least one. The offer code will only redeem for customers who
          match one of these segments.
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {ELIGIBILITY_OPTIONS.map((opt) => {
            const checked = eligibilities.includes(opt.value);
            return (
              <label
                key={opt.value}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  padding: '10px 12px', border: '1px solid var(--border)',
                  borderRadius: 8,
                  background: checked ? 'var(--accent-light, var(--bg-elevated, var(--bg)))' : 'transparent',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleEligibility(opt.value)}
                  style={{ marginTop: 2 }}
                />
                <div>
                  <div style={{ fontWeight: 600 }}>{opt.label}</div>
                  <div className="form-hint" style={{ marginTop: 2 }}>{opt.subtitle}</div>
                </div>
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );

  // ── Step 2 ──
  const step2 = (
    <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <p className="muted" style={{ fontSize: 12, margin: 0 }}>
        Pick the territories where this offer code can be redeemed. Defaults to
        every territory the IAP is available in.
      </p>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          className="form-input"
          type="search"
          placeholder="Search territories"
          value={territoryQuery}
          onChange={(e) => setTerritoryQuery(e.target.value)}
          style={{ flex: 1 }}
        />
        <button type="button" className="btn btn-secondary btn-sm" onClick={selectAllVisible}>
          Select all
        </button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={clearVisible}>
          Clear
        </button>
      </div>

      <div className="muted" style={{ fontSize: 12 }}>
        {selectedTerritories.size} of {availableTerritories.length} selected
      </div>

      <div
        style={{
          maxHeight: 360,
          overflowY: 'auto',
          border: '1px solid var(--border)',
          borderRadius: 8,
        }}
      >
        {isLoadingAvailability ? (
          <div className="loading" style={{ padding: 16 }}>
            <span className="spinner" /><span>Loading territories…</span>
          </div>
        ) : filteredTerritories.length === 0 ? (
          <div className="card-body" style={{ textAlign: 'center', padding: 16 }}>
            <span className="muted">No territories match this search.</span>
          </div>
        ) : (
          <table>
            <tbody>
              {filteredTerritories.map((t) => {
                const checked = selectedTerritories.has(t.territoryId);
                return (
                  <tr
                    key={t.territoryId}
                    style={{ cursor: 'pointer' }}
                    onClick={() => toggleTerritory(t.territoryId)}
                  >
                    <td style={{ width: 36 }}>
                      <input
                        type="checkbox"
                        checked={checked}
                        readOnly
                        style={{ pointerEvents: 'none' }}
                      />
                    </td>
                    <td className="cell-primary">{t.territoryName}</td>
                    <td className="muted cell-mono">{t.territoryId}</td>
                    <td className="muted">{t.currency}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );

  // ── Step 3 ──
  const handlePricePicked = async ({
    territoryId,
    pricePointId,
  }: { territoryId: string; pricePointId: string }) => {
    setPaidTerritoryId(territoryId);
    setPaidPricePointId(pricePointId);
    // Look up the formatted price for the summary card.
    try {
      const page = await iap.loadPricePoints({ territoryId, cursor: null, limit: 200 });
      const match = page.items.find((p: IAPPricePoint) => p.id === pricePointId);
      setPaidPricePointLabel(match ? `${match.formattedPrice} · ${match.proceeds} proceeds` : null);
    } catch (err) {
      console.warn('[iap-offer-code] price label lookup failed:', err);
      setPaidPricePointLabel(null);
    }
  };

  const step3 = (
    <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div
        style={{
          display: 'flex', gap: 8, padding: 4,
          border: '1px solid var(--border)', borderRadius: 8,
        }}
      >
        <button
          type="button"
          className={`btn btn-sm ${isFree ? 'btn-primary' : 'btn-secondary'}`}
          style={{ flex: 1 }}
          onClick={() => setIsFree(true)}
        >
          Free offer
        </button>
        <button
          type="button"
          className={`btn btn-sm ${!isFree ? 'btn-primary' : 'btn-secondary'}`}
          style={{ flex: 1 }}
          onClick={() => setIsFree(false)}
        >
          Paid offer
        </button>
      </div>

      {isFree ? (
        <div
          style={{
            padding: 16, border: '1px solid var(--border)',
            borderRadius: 8, textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 28 }}>🎁</div>
          <div style={{ fontWeight: 600, marginTop: 6 }}>Free for everyone</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
            Customers redeem at no cost. Apple charges no proceeds for free offers.
          </div>
        </div>
      ) : (
        <div
          style={{
            padding: 16, border: '1px solid var(--border)',
            borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 8,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 600 }}>Base territory</div>
              <div className="muted" style={{ fontSize: 12 }}>{paidTerritoryId}</div>
            </div>
            {paidPricePointLabel ? (
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 600 }}>{paidPricePointLabel.split(' · ')[0]}</div>
                <div className="muted" style={{ fontSize: 12 }}>{paidPricePointLabel.split(' · ')[1] ?? 'proceeds'}</div>
              </div>
            ) : (
              <span className="muted" style={{ fontSize: 12 }}>No price selected</span>
            )}
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setPickerOpen(true)}
          >
            {paidPricePointId ? 'Change price point…' : 'Pick price point…'}
          </button>
          <div className="form-hint">
            Pricing is anchored on this territory; Apple equalises across the
            other selected territories at submit time.
          </div>
        </div>
      )}
    </div>
  );

  // ── Step 4 ──
  const eligibilityLabels = eligibilities.map(
    (e) => ELIGIBILITY_OPTIONS.find((o) => o.value === e)?.label ?? e,
  );

  const step4 = (
    <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <p className="muted" style={{ fontSize: 12, margin: 0 }}>
        Review and create. After this, you can generate one-time-use codes
        and custom codes from the offer code's detail page.
      </p>

      <div
        style={{
          padding: 16, border: '1px solid var(--border)',
          borderRadius: 12,
          background: 'var(--bg-elevated, var(--bg))',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span className="muted">Reference name</span>
            <strong>{trimmed || '—'}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span className="muted">In-app purchase</span>
            <strong>{iap.referenceName}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span className="muted">Eligibility</span>
            <strong>{eligibilityLabels.join(', ')}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span className="muted">Territories</span>
            <strong>
              {selectedTerritories.size} of {availableTerritories.length}
            </strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span className="muted">Price</span>
            <strong>
              {isFree
                ? 'Free'
                : paidPricePointLabel
                  ? `${paidPricePointLabel.split(' · ')[0]} (${paidTerritoryId})`
                  : 'Not picked'}
            </strong>
          </div>
        </div>
      </div>

      {error && (
        <div className="form-hint" style={{ color: 'var(--danger-text)' }}>{error}</div>
      )}
    </div>
  );

  // ── Render ──

  return (
    <>
      <div className="modal-overlay open" onClick={onClose}>
        <div
          className="modal"
          style={{ maxWidth: 560 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="modal-header">
            <h3>New offer code · {iap.referenceName}</h3>
            <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Stepper */}
          <div
            style={{
              display: 'flex', gap: 8, padding: '12px 16px',
              borderBottom: '1px solid var(--border)',
            }}
          >
            {STEPS.map((s, i) => {
              const done = i < stepIndex;
              const active = i === stepIndex;
              return (
                <div
                  key={s.id}
                  style={{
                    flex: 1, display: 'flex', alignItems: 'center', gap: 6,
                    color: active ? 'var(--text)' : 'var(--muted)',
                    fontSize: 12, fontWeight: active ? 600 : 400,
                  }}
                >
                  <span
                    style={{
                      width: 22, height: 22, borderRadius: '50%',
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      background: done || active ? 'var(--accent, #0a84ff)' : 'var(--border)',
                      color: done || active ? '#fff' : 'var(--muted)',
                      fontSize: 11, fontWeight: 600,
                    }}
                  >
                    {done ? '✓' : i + 1}
                  </span>
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {s.title}
                  </span>
                </div>
              );
            })}
          </div>

          {step === 'name' && step1}
          {step === 'territories' && step2}
          {step === 'pricing' && step3}
          {step === 'confirm' && step4}

          <div className="modal-footer">
            {stepIndex > 0 ? (
              <button type="button" className="btn btn-secondary" onClick={goBack} disabled={submitting}>
                Back
              </button>
            ) : (
              <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>
                Cancel
              </button>
            )}
            <button
              type="button"
              className="btn btn-primary"
              onClick={advance}
              disabled={!canAdvance || submitting}
            >
              {step === 'confirm'
                ? (submitting ? 'Creating…' : 'Create offer code')
                : 'Next'}
            </button>
          </div>
        </div>
      </div>

      {/* Price-point picker reused — feeds local state instead of mutating the IAP. */}
      <PricePointPickerModal
        product={iap}
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        config={{
          productLabel: iap.referenceName,
          hasExistingPrice: paidPricePointId !== null,
          initialTerritoryId: paidTerritoryId,
          territoryFieldLabel: 'Base Territory',
          buckets: BUCKETS,
          defaultBucket: PriceBucket.All,
          filter: (p, bucket, query) => p.matchesBucket(bucket as PriceBucket) && p.matches(query),
          onConfirm: handlePricePicked,
        }}
      />
    </>
  );
}

export const CreateIAPOfferCodeModal = observer(CreateIAPOfferCodeModalImpl);
