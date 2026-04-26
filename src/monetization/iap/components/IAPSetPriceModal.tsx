import { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import type { InAppPurchase } from '../InAppPurchase.ts';

interface Props {
  iap: InAppPurchase;
  open: boolean;
  onClose: () => void;
}

/**
 * Minimal "set base price" sheet — single form, no paginated price-point
 * picker. The iOS prototype's full picker (filter pills + cursor pagination
 * + equalised preview) ships in a later phase; today the user picks a base
 * territory and types the Apple price-point ID directly. Once the call
 * resolves, the IAP refetches its schedule so the page reflects the
 * equalised territory rows.
 */
function IAPSetPriceModalImpl({ iap, open, onClose }: Props) {
  const existing = iap.priceSchedule;
  const [territoryId, setTerritoryId] = useState(existing?.baseTerritoryId ?? 'USA');
  const [pricePointId, setPricePointId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTerritoryId(existing?.baseTerritoryId ?? 'USA');
    setPricePointId('');
    setError(null);
    setSubmitting(false);
  }, [open, existing]);

  if (!open) return null;

  const trimmedTerritory = territoryId.trim();
  const trimmedPricePoint = pricePointId.trim();
  const canSubmit = !!trimmedTerritory && !!trimmedPricePoint && !submitting && iap.canSetPrice;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await iap.setPrice({ territoryId: trimmedTerritory, pricePointId: trimmedPricePoint });
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
          <h3>{existing ? 'Change Base Price' : 'Set Base Price'} · {iap.referenceName}</h3>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="modal-body">
          <div className="form-group">
            <label className="form-label" htmlFor="iap-set-territory">Base Territory *</label>
            <input
              id="iap-set-territory"
              className="form-input"
              type="text"
              value={territoryId}
              onChange={(e) => setTerritoryId(e.target.value.toUpperCase())}
              placeholder="e.g. USA"
              autoFocus
            />
            <div className="form-hint">
              Three-letter Apple territory code (USA, GBR, JPN, …).
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="iap-set-pricepoint">Price Point ID *</label>
            <input
              id="iap-set-pricepoint"
              className="form-input"
              type="text"
              value={pricePointId}
              onChange={(e) => setPricePointId(e.target.value)}
              placeholder="e.g. pp-9-99-USA"
              style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}
            />
            <div className="form-hint">
              Paste the Apple price-point ID for the desired tier in the base territory.
              Apple auto-equalises every other territory once this is set.
            </div>
          </div>

          {error && (
            <div className="form-hint" style={{ color: 'var(--danger-text)' }}>{error}</div>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={!canSubmit}>
            {submitting ? 'Saving…' : existing ? 'Change' : 'Set Price'}
          </button>
        </div>
      </form>
    </div>
  );
}

export const IAPSetPriceModal = observer(IAPSetPriceModalImpl);
