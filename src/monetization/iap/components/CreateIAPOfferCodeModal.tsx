import { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import type { InAppPurchase } from '../InAppPurchase.ts';
import { IAPCustomerEligibility } from '../InAppPurchaseOfferCode.ts';

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

/**
 * Minimal create-offer-code sheet — single form. Apple's full 4-step
 * wizard (territories + free/paid + price-point picker) ships in a later
 * phase. Today we capture name + eligibility flags and the backend
 * creates a free offer scoped to the IAP's existing availability.
 */
function CreateIAPOfferCodeModalImpl({ iap, open, onClose }: Props) {
  const [name, setName] = useState('');
  const [eligibilities, setEligibilities] = useState<IAPCustomerEligibility[]>([
    IAPCustomerEligibility.NonSpender,
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName('');
    setEligibilities([IAPCustomerEligibility.NonSpender]);
    setError(null);
    setSubmitting(false);
  }, [open]);

  if (!open) return null;

  const trimmed = name.trim();
  const canSubmit = !!trimmed && eligibilities.length > 0 && !submitting;

  const toggle = (value: IAPCustomerEligibility) => {
    setEligibilities((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true); setError(null);
    try {
      await iap.createOfferCode({ name: trimmed, customerEligibilities: eligibilities });
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
        style={{ maxWidth: 480 }}
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <div className="modal-header">
          <h3>New Offer Code · {iap.referenceName}</h3>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="modal-body">
          <div className="form-group">
            <label className="form-label" htmlFor="oc-name">Reference Name *</label>
            <input
              id="oc-name"
              className="form-input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. WELCOME20"
              autoFocus
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

export const CreateIAPOfferCodeModal = observer(CreateIAPOfferCodeModalImpl);
