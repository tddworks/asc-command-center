import { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import type { Subscription } from '../Subscription.ts';

interface Props {
  sub: Subscription;
  open: boolean;
  onClose: () => void;
}

/**
 * Minimal "set prices" sheet for a Subscription tier. Single anchor
 * territory + price-point ID — Apple equalises every other territory off
 * that pair. Full multi-territory wizard ships in a later phase.
 */
function SubscriptionSetPriceModalImpl({ sub, open, onClose }: Props) {
  const [territoryId, setTerritoryId] = useState('USA');
  const [pricePointId, setPricePointId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTerritoryId('USA');
    setPricePointId('');
    setError(null);
    setSubmitting(false);
  }, [open]);

  if (!open) return null;

  const trimmedTerritory = territoryId.trim();
  const trimmedPricePoint = pricePointId.trim();
  const canSubmit = !!trimmedTerritory && !!trimmedPricePoint && !submitting && sub.canSetPrices;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await sub.setPrices([{ territoryId: trimmedTerritory, pricePointId: trimmedPricePoint }]);
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
          <h3>{sub.priceSchedule ? 'Change Price' : 'Set Price'} · {sub.name}</h3>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="modal-body">
          <div className="form-group">
            <label className="form-label" htmlFor="sub-set-territory">Anchor Territory *</label>
            <input
              id="sub-set-territory"
              className="form-input"
              type="text"
              value={territoryId}
              onChange={(e) => setTerritoryId(e.target.value.toUpperCase())}
              placeholder="e.g. USA"
              autoFocus
            />
            <div className="form-hint">
              Three-letter Apple territory code. Apple equalises every other territory off this one.
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="sub-set-pricepoint">Price Point ID *</label>
            <input
              id="sub-set-pricepoint"
              className="form-input"
              type="text"
              value={pricePointId}
              onChange={(e) => setPricePointId(e.target.value)}
              placeholder="e.g. pp-9-99-USA"
              style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}
            />
          </div>

          {error && (
            <div className="form-hint" style={{ color: 'var(--danger-text)' }}>{error}</div>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={!canSubmit}>
            {submitting ? 'Saving…' : 'Set Price'}
          </button>
        </div>
      </form>
    </div>
  );
}

export const SubscriptionSetPriceModal = observer(SubscriptionSetPriceModalImpl);
