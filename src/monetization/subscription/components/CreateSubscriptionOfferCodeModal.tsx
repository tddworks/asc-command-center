import { useEffect, useMemo, useState } from 'react';
import { observer } from 'mobx-react-lite';
import type { Subscription } from '../Subscription.ts';
import {
  OfferMode,
  SubscriptionCustomerEligibility,
  SubscriptionDuration,
  SubscriptionOfferEligibility,
  type SubscriptionOfferCodePriceInput,
} from '../SubscriptionOffers.ts';
import { SubscriptionPriceBucket, type SubscriptionPricePoint } from '../SubscriptionPricePoint.ts';
import {
  PricePointPickerModal,
  type PricePointBucketPill,
} from '../../components/PricePointPickerModal.tsx';

interface Props {
  sub: Subscription;
  open: boolean;
  onClose: () => void;
}

const ELIGIBILITY_OPTIONS: { value: SubscriptionCustomerEligibility; label: string; subtitle: string }[] = [
  { value: SubscriptionCustomerEligibility.New, label: 'New subscribers', subtitle: 'Have not subscribed before' },
  { value: SubscriptionCustomerEligibility.PaidSubscriber, label: 'Paid subscribers', subtitle: 'Currently paying for the subscription' },
  { value: SubscriptionCustomerEligibility.Lapsed, label: 'Lapsed subscribers', subtitle: 'Previously subscribed; subscription has expired' },
  { value: SubscriptionCustomerEligibility.WinBack, label: 'Win-back', subtitle: 'Targeted re-engagement of churned subscribers' },
];

const PERIOD_OPTIONS: { value: SubscriptionDuration; label: string }[] = [
  { value: SubscriptionDuration.OneWeek, label: '1 Week' },
  { value: SubscriptionDuration.OneMonth, label: '1 Month' },
  { value: SubscriptionDuration.TwoMonths, label: '2 Months' },
  { value: SubscriptionDuration.ThreeMonths, label: '3 Months' },
  { value: SubscriptionDuration.SixMonths, label: '6 Months' },
  { value: SubscriptionDuration.OneYear, label: '1 Year' },
];

const MODE_OPTIONS: { value: OfferMode; label: string; subtitle: string }[] = [
  { value: OfferMode.FreeTrial, label: 'Free Trial', subtitle: 'No charge for the offer period' },
  { value: OfferMode.PayAsYouGo, label: 'Pay as You Go', subtitle: 'Discounted price per period' },
  { value: OfferMode.PayUpFront, label: 'Pay Up Front', subtitle: 'Single discounted up-front charge' },
];

const OFFER_ELIGIBILITY_OPTIONS: {
  value: SubscriptionOfferEligibility;
  label: string;
  subtitle: string;
}[] = [
  {
    value: SubscriptionOfferEligibility.Stackable,
    label: 'Stackable',
    subtitle: 'Redeemable alongside an existing intro offer',
  },
  {
    value: SubscriptionOfferEligibility.Introductory,
    label: 'Introductory',
    subtitle: "Treated as the customer's intro offer — they forfeit any other intro offer",
  },
  {
    value: SubscriptionOfferEligibility.SubscriptionOffer,
    label: 'Subscription offer',
    subtitle: 'Treated as a standard subscription offer (post-intro)',
  },
];

const BUCKETS: PricePointBucketPill[] = [
  { value: SubscriptionPriceBucket.All, label: 'All' },
  { value: SubscriptionPriceBucket.Under1, label: '<$1' },
  { value: SubscriptionPriceBucket.From1To10, label: '$1–$10' },
  { value: SubscriptionPriceBucket.From10To50, label: '$10–$50' },
  { value: SubscriptionPriceBucket.From50To100, label: '$50–$100' },
  { value: SubscriptionPriceBucket.Over100, label: '$100+' },
];

const STEPS = [
  { id: 'name', title: 'Name & eligibility' },
  { id: 'territories', title: 'Territories' },
  { id: 'offerType', title: 'Offer type' },
  { id: 'confirm', title: 'Confirm' },
] as const;

type StepId = typeof STEPS[number]['id'];

const MAX_NAME_LENGTH = 60;

const MODE_LABELS: Record<string, string> = {
  [OfferMode.FreeTrial]: 'Free Trial',
  [OfferMode.PayAsYouGo]: 'Pay as You Go',
  [OfferMode.PayUpFront]: 'Pay Up Front',
};
const DURATION_LABELS: Record<string, string> = {
  [SubscriptionDuration.OneWeek]: '1 Week',
  [SubscriptionDuration.OneMonth]: '1 Month',
  [SubscriptionDuration.TwoMonths]: '2 Months',
  [SubscriptionDuration.ThreeMonths]: '3 Months',
  [SubscriptionDuration.SixMonths]: '6 Months',
  [SubscriptionDuration.OneYear]: '1 Year',
};

/** Modes that need a price point picked (paid offers). */
function requiresPricePoint(mode: OfferMode): boolean {
  return mode === OfferMode.PayAsYouGo || mode === OfferMode.PayUpFront;
}

/**
 * 4-step wizard mirroring iOS's `iOSCreateOfferCodeSheet`:
 *
 *   1. Name + customer eligibility + auto-renew + offer eligibility
 *      (intro-offer stack/replace question only shown when New/Lapsed
 *      customers are selected — and disabled when auto-renew is off).
 *   2. Territories (multi-select; defaults to all available).
 *   3. Offer type — mode (Free Trial / Pay as You Go / Pay Up Front),
 *      duration, periods, plus a price-point picker for paid modes.
 *      Non-renewing offers force Free Trial.
 *   4. Confirm summary.
 *
 * Forwards `prices`, `autoRenewEnabled`, and `offerEligibility` to
 * `sub.createOfferCode`.
 */
function CreateSubscriptionOfferCodeModalImpl({ sub, open, onClose }: Props) {
  const [step, setStep] = useState<StepId>('name');

  // Step 1
  const [name, setName] = useState('');
  const [eligibilities, setEligibilities] = useState<SubscriptionCustomerEligibility[]>([
    SubscriptionCustomerEligibility.New,
  ]);
  const [autoRenew, setAutoRenew] = useState(true);
  const [offerEligibility, setOfferEligibility] = useState<SubscriptionOfferEligibility>(
    SubscriptionOfferEligibility.Stackable,
  );

  // Step 2
  const [selectedTerritories, setSelectedTerritories] = useState<Set<string>>(new Set());
  const [territoryQuery, setTerritoryQuery] = useState('');
  const [isLoadingAvailability, setIsLoadingAvailability] = useState(false);

  // Step 3
  const [mode, setMode] = useState<OfferMode>(OfferMode.FreeTrial);
  const [duration, setDuration] = useState<SubscriptionDuration>(SubscriptionDuration.OneMonth);
  const [periods, setPeriods] = useState(1);
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
    setEligibilities([SubscriptionCustomerEligibility.New]);
    setAutoRenew(true);
    setOfferEligibility(SubscriptionOfferEligibility.Stackable);
    setSelectedTerritories(new Set());
    setTerritoryQuery('');
    setMode(OfferMode.FreeTrial);
    setDuration(SubscriptionDuration.OneMonth);
    setPeriods(1);
    setPaidTerritoryId('USA');
    setPaidPricePointId(null);
    setPaidPricePointLabel(null);
    setPickerOpen(false);
    setSubmitting(false);
    setError(null);

    let cancelled = false;
    void (async () => {
      if (sub.isAvailabilityLoaded && sub.availability) return;
      setIsLoadingAvailability(true);
      try {
        await sub.loadAvailability();
      } catch (err) {
        console.warn('[sub-offer-code] loadAvailability failed:', err);
      } finally {
        if (!cancelled) setIsLoadingAvailability(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, sub]);

  // Pre-select all available territories the first time availability lands.
  useEffect(() => {
    if (!open) return;
    if (selectedTerritories.size > 0) return;
    const list = sub.availability?.territories.filter((t) => t.isAvailable) ?? [];
    if (list.length === 0) return;
    setSelectedTerritories(new Set(list.map((t) => t.territoryId)));
  }, [open, sub.availability, sub.isAvailabilityLoaded, selectedTerritories.size]);

  // Auto-renew off → mode forced to FreeTrial (matches iOS UX).
  useEffect(() => {
    if (!autoRenew) setMode(OfferMode.FreeTrial);
  }, [autoRenew]);

  const stepIndex = STEPS.findIndex((s) => s.id === step);

  const availableTerritories = useMemo(
    () => sub.availability?.territories.filter((t) => t.isAvailable) ?? [],
    [sub.availability],
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

  const showIntroductoryOffersChoice =
    eligibilities.includes(SubscriptionCustomerEligibility.New) ||
    eligibilities.includes(SubscriptionCustomerEligibility.Lapsed) ||
    eligibilities.includes(SubscriptionCustomerEligibility.WinBack);

  const trimmed = name.trim();

  const canAdvance =
    step === 'name'
      ? !!trimmed && eligibilities.length > 0
      : step === 'territories'
        ? selectedTerritories.size > 0
        : step === 'offerType'
          ? periods >= 1 && (!requiresPricePoint(mode) || paidPricePointId !== null)
          : true;

  if (!open) return null;

  const advance = () => {
    if (step === 'confirm') { void create(); return; }
    const next = STEPS[stepIndex + 1];
    if (next) setStep(next.id);
  };

  const goBack = () => {
    const prev = STEPS[stepIndex - 1];
    if (prev) setStep(prev.id);
  };

  const toggleEligibility = (value: SubscriptionCustomerEligibility) => {
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

  const handlePricePicked = async ({
    territoryId,
    pricePointId,
  }: { territoryId: string; pricePointId: string }) => {
    setPaidTerritoryId(territoryId);
    setPaidPricePointId(pricePointId);
    try {
      const page = await sub.loadPricePoints({ territoryId, cursor: null, limit: 200 });
      const match = page.items.find((p: SubscriptionPricePoint) => p.id === pricePointId);
      setPaidPricePointLabel(match ? `${match.formattedPrice} · ${match.proceeds} proceeds` : null);
    } catch (err) {
      console.warn('[sub-offer-code] price label lookup failed:', err);
      setPaidPricePointLabel(null);
    }
  };

  const buildPrices = (): SubscriptionOfferCodePriceInput[] => {
    const territories = Array.from(selectedTerritories);
    if (!requiresPricePoint(mode)) {
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
      await sub.createOfferCode({
        name: trimmed,
        offerMode: mode,
        duration,
        numberOfPeriods: periods,
        customerEligibilities: eligibilities,
        autoRenewEnabled: autoRenew,
        offerEligibility: showIntroductoryOffersChoice && autoRenew ? offerEligibility : null,
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
        <label className="form-label" htmlFor="soc-name">Reference Name *</label>
        <input
          id="soc-name"
          className="form-input"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, MAX_NAME_LENGTH))}
          placeholder="e.g. WELCOME50"
          autoFocus
        />
        <div className="form-hint" style={{ textAlign: 'right' }}>
          {MAX_NAME_LENGTH - name.length} characters left
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Customer Eligibility *</label>
        <div className="form-hint" style={{ marginBottom: 8 }}>
          Pick at least one. The offer code will only redeem for subscribers
          who match one of these segments.
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

      <div className="form-group">
        <label className="form-label">Subscription renewal</label>
        <label
          style={{
            display: 'flex', alignItems: 'flex-start', gap: 10,
            padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8,
            background: !autoRenew ? 'var(--accent-light, var(--bg-elevated, var(--bg)))' : 'transparent',
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={!autoRenew}
            onChange={(e) => setAutoRenew(!e.target.checked)}
            style={{ marginTop: 2 }}
          />
          <div>
            <div style={{ fontWeight: 600 }}>Don't auto-renew this offer</div>
            <div className="form-hint" style={{ marginTop: 2 }}>
              Non-renewing offers only support Free Trial mode.
            </div>
          </div>
        </label>
      </div>

      {showIntroductoryOffersChoice && (
        <div className="form-group">
          <label className="form-label">Stacks with intro offers?</label>
          <div className="form-hint" style={{ marginBottom: 8 }}>
            Only applies when New, Lapsed, or Win-Back subscribers are eligible.
            {!autoRenew && ' Stacking is only meaningful for auto-renewing offers.'}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {OFFER_ELIGIBILITY_OPTIONS.map((opt) => {
              const checked = offerEligibility === opt.value;
              const disabled = !autoRenew;
              return (
                <label
                  key={opt.value}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10,
                    padding: '10px 12px', border: '1px solid var(--border)',
                    borderRadius: 8,
                    background: checked && !disabled ? 'var(--accent-light, var(--bg-elevated, var(--bg)))' : 'transparent',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    opacity: disabled ? 0.5 : 1,
                  }}
                >
                  <input
                    type="radio"
                    name="offer-eligibility"
                    value={opt.value}
                    checked={checked}
                    onChange={() => setOfferEligibility(opt.value)}
                    disabled={disabled}
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
      )}
    </div>
  );

  // ── Step 2 ──
  const step2 = (
    <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <p className="muted" style={{ fontSize: 12, margin: 0 }}>
        Pick the territories where this offer code can be redeemed. Defaults to
        every territory the subscription is available in.
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
  const step3 = (
    <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {!autoRenew && (
        <div
          style={{
            padding: 12,
            border: '1px solid var(--border)',
            borderRadius: 8,
            background: 'var(--bg-elevated, var(--bg))',
            fontSize: 13,
          }}
        >
          <strong>Free Trial only</strong>
          <div className="form-hint" style={{ marginTop: 4 }}>
            Non-renewing offers don't support paid modes — pick a duration and
            period count below.
          </div>
        </div>
      )}

      {autoRenew && (
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Mode</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {MODE_OPTIONS.map((opt) => {
              const checked = mode === opt.value;
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
                    type="radio"
                    name="offer-mode"
                    value={opt.value}
                    checked={checked}
                    onChange={() => setMode(opt.value)}
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
      )}

      <div className="form-row" style={{ display: 'flex', gap: 12 }}>
        <div className="form-group" style={{ flex: 1 }}>
          <label className="form-label" htmlFor="soc-duration">Duration</label>
          <select
            id="soc-duration"
            className="form-input"
            value={duration}
            onChange={(e) => setDuration(e.target.value as SubscriptionDuration)}
          >
            {PERIOD_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div className="form-group" style={{ flex: 1 }}>
          <label className="form-label" htmlFor="soc-periods">Periods</label>
          <input
            id="soc-periods"
            className="form-input"
            type="number"
            min={1}
            value={periods}
            onChange={(e) => setPeriods(Math.max(1, parseInt(e.target.value, 10) || 1))}
          />
        </div>
      </div>

      {!requiresPricePoint(mode) ? (
        <div
          style={{
            padding: 16, border: '1px solid var(--border)',
            borderRadius: 8, textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 28 }}>🎁</div>
          <div style={{ fontWeight: 600, marginTop: 6 }}>Free for everyone</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
            Subscribers redeem at no cost for the offer period.
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
              <div style={{ fontWeight: 600 }}>Anchor territory</div>
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
          borderRadius: 12, background: 'var(--bg-elevated, var(--bg))',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span className="muted">Reference name</span>
            <strong>{trimmed || '—'}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span className="muted">Subscription</span>
            <strong>{sub.name}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span className="muted">Eligibility</span>
            <strong>{eligibilityLabels.join(', ')}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span className="muted">Auto-renew</span>
            <strong>{autoRenew ? 'Yes' : 'No'}</strong>
          </div>
          {showIntroductoryOffersChoice && autoRenew && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span className="muted">Intro offers</span>
              <strong>
                {OFFER_ELIGIBILITY_OPTIONS.find((o) => o.value === offerEligibility)?.label ?? offerEligibility}
              </strong>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span className="muted">Mode</span>
            <strong>{MODE_LABELS[mode]}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span className="muted">Duration</span>
            <strong>
              {periods === 1
                ? DURATION_LABELS[duration]
                : `${periods} × ${DURATION_LABELS[duration]}`}
            </strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span className="muted">Territories</span>
            <strong>{selectedTerritories.size} of {availableTerritories.length}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span className="muted">Price</span>
            <strong>
              {!requiresPricePoint(mode)
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
          style={{ maxWidth: 600 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="modal-header">
            <h3>New offer code · {sub.name}</h3>
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
          {step === 'offerType' && step3}
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

      <PricePointPickerModal
        product={sub}
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        config={{
          productLabel: sub.name,
          hasExistingPrice: paidPricePointId !== null,
          initialTerritoryId: paidTerritoryId,
          territoryFieldLabel: 'Anchor Territory',
          buckets: BUCKETS,
          defaultBucket: SubscriptionPriceBucket.All,
          filter: (p, bucket, query) =>
            p.matchesBucket(bucket as SubscriptionPriceBucket) && p.matches(query),
          onConfirm: handlePricePicked,
        }}
      />
    </>
  );
}

export const CreateSubscriptionOfferCodeModal = observer(CreateSubscriptionOfferCodeModalImpl);
