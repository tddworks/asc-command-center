import { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import type { SubscriptionOfferCode } from '../SubscriptionOffers.ts';
import { CodeEnvironment } from '../SubscriptionOffers.ts';

interface Props {
  code: SubscriptionOfferCode;
  environment: CodeEnvironment;
  open: boolean;
  onClose: () => void;
}

const PRODUCTION_OPTIONS = [200, 500, 1_000, 2_000, 3_000, 5_000, 10_000, 15_000, 25_000];
const SANDBOX_OPTIONS = [10, 100, 200, 500, 1_000];

function defaultExpiration(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 6);
  return d.toISOString().slice(0, 10);
}

/** Subscription mirror of `IAPGenerateOneTimeCodesModal`. */
function SubscriptionGenerateOneTimeCodesModalImpl({ code, environment, open, onClose }: Props) {
  const isSandbox = environment === CodeEnvironment.Sandbox;
  const options = isSandbox ? SANDBOX_OPTIONS : PRODUCTION_OPTIONS;

  const [count, setCount] = useState<number>(0);
  const [expiration, setExpiration] = useState<string>(defaultExpiration());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setCount(0);
    setExpiration(defaultExpiration());
    setBusy(false);
    setError(null);
  }, [open]);

  const canGenerate = count > 0 && !busy;

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canGenerate) return;
    setBusy(true); setError(null);
    try {
      await code.generateOneTimeUseCodes({ count, environment, expirationDate: expiration });
      onClose();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <div className="modal-overlay open" onClick={onClose}>
      <form
        className="modal"
        style={{ maxWidth: 480 }}
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleGenerate}
      >
        <div className="modal-header">
          <h3>{isSandbox ? 'Generate Sandbox Codes' : 'Generate One-Time Codes'}</h3>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p className="muted" style={{ fontSize: 12, margin: 0 }}>
            {isSandbox
              ? 'Sandbox codes can be redeemed only by sandbox testers. Use them to verify the redemption flow without spending production budget.'
              : 'One-time-use codes can each be redeemed by a single subscriber. Pick a batch size — Apple equalises pricing across the offer\'s territories.'}
          </p>

          <div className="form-group">
            <label className="form-label">Number of codes</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {options.map((opt) => (
                <button
                  type="button"
                  key={opt}
                  onClick={() => setCount(opt)}
                  className={`btn btn-sm ${count === opt ? 'btn-primary' : 'btn-secondary'}`}
                >
                  {opt.toLocaleString('en-US')}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="sub-otu-exp">Expiration date</label>
            <input
              id="sub-otu-exp"
              className="form-input"
              type="date"
              value={expiration}
              min={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setExpiration(e.target.value)}
            />
            <div className="form-hint">
              Codes can no longer be redeemed after this date. Defaults to six months out.
            </div>
          </div>

          {count > 0 && (
            <div
              style={{
                padding: 12, border: '1px solid var(--border)', borderRadius: 8,
                background: 'var(--bg-elevated, var(--bg))',
                display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="muted">Codes to generate</span>
                <strong>{count.toLocaleString('en-US')}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="muted">Expires</span>
                <strong>{expiration}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="muted">Environment</span>
                <strong>{isSandbox ? 'Sandbox' : 'Production'}</strong>
              </div>
            </div>
          )}

          {error && (
            <div className="form-hint" style={{ color: 'var(--danger-text)' }}>{error}</div>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={!canGenerate}>
            {busy ? 'Generating…' : `Generate ${count > 0 ? count.toLocaleString('en-US') : ''} codes`}
          </button>
        </div>
      </form>
    </div>
  );
}

export const SubscriptionGenerateOneTimeCodesModal = observer(SubscriptionGenerateOneTimeCodesModalImpl);
