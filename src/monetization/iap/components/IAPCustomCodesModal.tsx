import { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import type { InAppPurchaseOfferCode } from '../InAppPurchaseOfferCode.ts';

interface Props {
  code: InAppPurchaseOfferCode;
  open: boolean;
  onClose: () => void;
}

/**
 * Manage developer-defined custom codes for an offer code. Mirrors iOS's
 * `iOSIAPCustomCodesListView` — list of existing codes plus an inline
 * create form. Custom codes are single strings (e.g. "BLACKFRIDAY26")
 * that each customer can redeem up to `numberOfCodes` times.
 */
function IAPCustomCodesModalImpl({ code, open, onClose }: Props) {
  const [customCode, setCustomCode] = useState('');
  const [count, setCount] = useState<string>('1000');
  const [expiration, setExpiration] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setCustomCode('');
    setCount('1000');
    setExpiration('');
    setError(null);
    setBusy(false);
    if (!code.isCustomCodesLoaded) {
      void code.loadCustomCodes().catch((err) => {
        console.warn('[iap-offer-code] loadCustomCodes failed:', err);
      });
    }
  }, [open, code]);

  if (!open) return null;

  const trimmed = customCode.trim();
  const parsedCount = parseInt(count, 10);
  const canCreate = !!trimmed && parsedCount > 0 && !busy;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCreate) return;
    setBusy(true); setError(null);
    try {
      await code.createCustomCode({
        customCode: trimmed,
        numberOfCodes: parsedCount,
        expirationDate: expiration || null,
      });
      setCustomCode('');
      setCount('1000');
      setExpiration('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-overlay open" onClick={onClose}>
      <div
        className="modal"
        style={{ maxWidth: 720 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3>Custom Codes · {code.name}</h3>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p className="muted" style={{ fontSize: 12, margin: 0 }}>
            Custom codes are developer-defined strings (e.g. <code>BLACKFRIDAY26</code>) that
            customers can redeem on the App Store. Each code supports up to
            <em> max redemptions</em> uses before it stops accepting redemptions.
          </p>

          <form onSubmit={handleCreate} className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Add a custom code</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input
                className="form-input"
                style={{ flex: '1 1 200px', minWidth: 160, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}
                placeholder="BLACKFRIDAY26"
                value={customCode}
                onChange={(e) => setCustomCode(e.target.value.toUpperCase())}
                spellCheck={false}
                autoCapitalize="characters"
                autoCorrect="off"
              />
              <input
                className="form-input"
                type="number"
                style={{ width: 120 }}
                min={1}
                value={count}
                onChange={(e) => setCount(e.target.value)}
                placeholder="Redemptions"
              />
              <input
                className="form-input"
                type="date"
                style={{ width: 170 }}
                min={new Date().toISOString().slice(0, 10)}
                value={expiration}
                onChange={(e) => setExpiration(e.target.value)}
              />
              <button
                type="submit"
                className="btn btn-primary btn-sm"
                disabled={!canCreate}
              >
                {busy ? 'Adding…' : 'Add'}
              </button>
            </div>
            <div className="form-hint" style={{ marginTop: 6 }}>
              Code · max redemptions · expiration (optional). Defaults to 1,000 redemptions.
            </div>
            {error && (
              <div className="form-hint" style={{ color: 'var(--danger-text)', marginTop: 4 }}>
                {error}
              </div>
            )}
          </form>

          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
              <strong>Existing codes</strong>
              <span className="muted">
                {code.customCodes.length} code{code.customCodes.length === 1 ? '' : 's'}
                {code.customCodes.length > 0 && ` · ${code.totalCustomCodes.toLocaleString('en-US')} total redemptions`}
              </span>
            </div>

            {!code.isCustomCodesLoaded ? (
              <div className="loading"><span className="spinner" /><span>Loading custom codes…</span></div>
            ) : code.customCodes.length === 0 ? (
              <div className="card-body" style={{ textAlign: 'center', padding: 20 }}>
                <span className="muted">No custom codes yet.</span>
              </div>
            ) : (
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Redemptions</th>
                      <th>Expires</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {code.customCodes.map((c) => (
                      <tr key={c.id}>
                        <td className="cell-mono">{c.customCode}</td>
                        <td>{c.numberOfCodes.toLocaleString('en-US')}</td>
                        <td>{c.expirationDate ?? '—'}</td>
                        <td>
                          <span className={`status ${c.isActive ? 'live' : ''}`}>
                            {c.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}

export const IAPCustomCodesModal = observer(IAPCustomCodesModalImpl);
