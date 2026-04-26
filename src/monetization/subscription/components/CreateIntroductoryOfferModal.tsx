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

function CreateIntroductoryOfferModalImpl({ sub, open, onClose }: Props) {
  const [mode, setMode] = useState<OfferMode>(OfferMode.FreeTrial);
  const [duration, setDuration] = useState<SubscriptionDuration>(SubscriptionDuration.OneWeek);
  const [periods, setPeriods] = useState(1);
  const [territory, setTerritory] = useState('USA');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setMode(OfferMode.FreeTrial);
    setDuration(SubscriptionDuration.OneWeek);
    setPeriods(1);
    setTerritory('USA');
    setStartDate('');
    setEndDate('');
    setError(null);
    setSubmitting(false);
  }, [open]);

  if (!open) return null;

  const canSubmit = !submitting && periods >= 1;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true); setError(null);
    try {
      await sub.createIntroductoryOffer({
        offerMode: mode,
        duration,
        numberOfPeriods: periods,
        territory: territory.trim() || null,
        startDate: startDate || null,
        endDate: endDate || null,
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
          <h3>New Introductory Offer · {sub.name}</h3>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="modal-body">
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

          <div className="form-group">
            <label className="form-label">Territory</label>
            <input
              className="form-input"
              type="text"
              value={territory}
              onChange={(e) => setTerritory(e.target.value.toUpperCase())}
              placeholder="USA"
            />
            <div className="form-hint">Three-letter Apple territory code, or empty for all available territories.</div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Start Date</label>
              <input
                className="form-input"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">End Date (optional)</label>
              <input
                className="form-input"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
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

export const CreateIntroductoryOfferModal = observer(CreateIntroductoryOfferModalImpl);
