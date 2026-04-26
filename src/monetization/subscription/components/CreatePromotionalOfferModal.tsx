import { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import type { Subscription } from '../Subscription.ts';
import { OfferMode, SubscriptionDuration } from '../SubscriptionOffers.ts';

interface Props {
  sub: Subscription;
  open: boolean;
  onClose: () => void;
}

const MODE_OPTIONS: { value: OfferMode; label: string }[] = [
  { value: OfferMode.FreeTrial, label: 'Free Trial' },
  { value: OfferMode.PayAsYouGo, label: 'Pay as You Go' },
  { value: OfferMode.PayUpFront, label: 'Pay Up Front' },
];

const PERIOD_OPTIONS: { value: SubscriptionDuration; label: string }[] = [
  { value: SubscriptionDuration.OneWeek, label: '1 Week' },
  { value: SubscriptionDuration.OneMonth, label: '1 Month' },
  { value: SubscriptionDuration.TwoMonths, label: '2 Months' },
  { value: SubscriptionDuration.ThreeMonths, label: '3 Months' },
  { value: SubscriptionDuration.SixMonths, label: '6 Months' },
  { value: SubscriptionDuration.OneYear, label: '1 Year' },
];

function slugifyOfferCode(name: string): string {
  return name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function CreatePromotionalOfferModalImpl({ sub, open, onClose }: Props) {
  const [name, setName] = useState('');
  const [offerCode, setOfferCode] = useState('');
  const [offerCodeDirty, setOfferCodeDirty] = useState(false);
  const [mode, setMode] = useState<OfferMode>(OfferMode.PayAsYouGo);
  const [duration, setDuration] = useState<SubscriptionDuration>(SubscriptionDuration.OneMonth);
  const [periods, setPeriods] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName('');
    setOfferCode('');
    setOfferCodeDirty(false);
    setMode(OfferMode.PayAsYouGo);
    setDuration(SubscriptionDuration.OneMonth);
    setPeriods(1);
    setError(null);
    setSubmitting(false);
  }, [open]);

  useEffect(() => {
    if (!open || offerCodeDirty) return;
    setOfferCode(slugifyOfferCode(name));
  }, [name, offerCodeDirty, open]);

  if (!open) return null;

  const trimmedName = name.trim();
  const trimmedOfferCode = offerCode.trim();
  const canSubmit = !!trimmedName && !!trimmedOfferCode && periods >= 1 && !submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true); setError(null);
    try {
      await sub.createPromotionalOffer({
        name: trimmedName,
        offerCode: trimmedOfferCode,
        offerMode: mode,
        duration,
        numberOfPeriods: periods,
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
          <h3>New Promotional Offer · {sub.name}</h3>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Reference Name *</label>
            <input
              className="form-input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Holiday 2026"
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              Offer Identifier *
              {!offerCodeDirty && <span className="form-hint" style={{ marginLeft: 6 }}>(auto)</span>}
            </label>
            <input
              className="form-input"
              type="text"
              value={offerCode}
              onChange={(e) => { setOfferCodeDirty(true); setOfferCode(e.target.value); }}
              placeholder="HOLIDAY_2026"
              style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}
            />
            <div className="form-hint">Stable identifier passed to StoreKit when presenting the offer.</div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Mode *</label>
              <select className="form-input" value={mode} onChange={(e) => setMode(e.target.value as OfferMode)}>
                {MODE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Duration *</label>
              <select className="form-input" value={duration} onChange={(e) => setDuration(e.target.value as SubscriptionDuration)}>
                {PERIOD_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Number of Periods *</label>
            <input
              className="form-input"
              type="number"
              min={1}
              value={periods}
              onChange={(e) => setPeriods(Math.max(1, parseInt(e.target.value, 10) || 1))}
            />
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

export const CreatePromotionalOfferModal = observer(CreatePromotionalOfferModalImpl);
