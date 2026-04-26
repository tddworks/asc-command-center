import { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import type { Subscription } from '../Subscription.ts';
import {
  OfferMode,
  SubscriptionCustomerEligibility,
  SubscriptionDuration,
} from '../SubscriptionOffers.ts';

interface Props {
  sub: Subscription;
  open: boolean;
  onClose: () => void;
}

const ELIGIBILITY_OPTIONS: { value: SubscriptionCustomerEligibility; label: string; subtitle: string }[] = [
  { value: SubscriptionCustomerEligibility.New, label: 'New subscribers', subtitle: 'Have not subscribed before' },
  { value: SubscriptionCustomerEligibility.Existing, label: 'Existing subscribers', subtitle: 'Currently subscribed' },
  { value: SubscriptionCustomerEligibility.Expired, label: 'Expired subscribers', subtitle: 'Previously subscribed' },
];

const PERIOD_OPTIONS: { value: SubscriptionDuration; label: string }[] = [
  { value: SubscriptionDuration.OneWeek, label: '1 Week' },
  { value: SubscriptionDuration.OneMonth, label: '1 Month' },
  { value: SubscriptionDuration.TwoMonths, label: '2 Months' },
  { value: SubscriptionDuration.ThreeMonths, label: '3 Months' },
  { value: SubscriptionDuration.SixMonths, label: '6 Months' },
  { value: SubscriptionDuration.OneYear, label: '1 Year' },
];

const MODE_OPTIONS: { value: OfferMode; label: string }[] = [
  { value: OfferMode.FreeTrial, label: 'Free Trial' },
  { value: OfferMode.PayAsYouGo, label: 'Pay as You Go' },
  { value: OfferMode.PayUpFront, label: 'Pay Up Front' },
];

function CreateSubscriptionOfferCodeModalImpl({ sub, open, onClose }: Props) {
  const [name, setName] = useState('');
  const [mode, setMode] = useState<OfferMode>(OfferMode.FreeTrial);
  const [duration, setDuration] = useState<SubscriptionDuration>(SubscriptionDuration.OneMonth);
  const [periods, setPeriods] = useState(1);
  const [eligibilities, setEligibilities] = useState<SubscriptionCustomerEligibility[]>([
    SubscriptionCustomerEligibility.New,
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName('');
    setMode(OfferMode.FreeTrial);
    setDuration(SubscriptionDuration.OneMonth);
    setPeriods(1);
    setEligibilities([SubscriptionCustomerEligibility.New]);
    setError(null);
    setSubmitting(false);
  }, [open]);

  if (!open) return null;

  const trimmed = name.trim();
  const canSubmit = !!trimmed && eligibilities.length > 0 && periods >= 1 && !submitting;

  const toggle = (value: SubscriptionCustomerEligibility) => {
    setEligibilities((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true); setError(null);
    try {
      await sub.createOfferCode({
        name: trimmed,
        offerMode: mode,
        duration,
        numberOfPeriods: periods,
        customerEligibilities: eligibilities,
      });
      onClose();
    } catch (err) {
      setError((err as Error).message);
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay open" onClick={onClose}>
      <form
        className="modal"
        style={{ maxWidth: 520 }}
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <div className="modal-header">
          <h3>New Offer Code · {sub.name}</h3>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="modal-body">
          <div className="form-group">
            <label className="form-label" htmlFor="soc-name">Reference Name *</label>
            <input
              id="soc-name"
              className="form-input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. WELCOME50"
              autoFocus
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="soc-mode">Mode *</label>
              <select id="soc-mode" className="form-input" value={mode} onChange={(e) => setMode(e.target.value as OfferMode)}>
                {MODE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="soc-duration">Duration *</label>
              <select id="soc-duration" className="form-input" value={duration} onChange={(e) => setDuration(e.target.value as SubscriptionDuration)}>
                {PERIOD_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="soc-periods">Number of Periods *</label>
            <input
              id="soc-periods"
              className="form-input"
              type="number"
              min={1}
              value={periods}
              onChange={(e) => setPeriods(Math.max(1, parseInt(e.target.value, 10) || 1))}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Customer Eligibility *</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {ELIGIBILITY_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10,
                    padding: '10px 12px', border: '1px solid var(--border)',
                    borderRadius: 8,
                    background: eligibilities.includes(opt.value) ? 'var(--accent-light)' : 'transparent',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={eligibilities.includes(opt.value)}
                    onChange={() => toggle(opt.value)}
                    style={{ marginTop: 2 }}
                  />
                  <div>
                    <div style={{ fontWeight: 600 }}>{opt.label}</div>
                    <div className="form-hint" style={{ marginTop: 2 }}>{opt.subtitle}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {error && (
            <div className="form-hint" style={{ color: 'var(--danger-text)' }}>{error}</div>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={!canSubmit}>
            {submitting ? 'Creating…' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  );
}

export const CreateSubscriptionOfferCodeModal = observer(CreateSubscriptionOfferCodeModalImpl);
