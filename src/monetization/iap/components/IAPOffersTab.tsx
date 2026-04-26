import { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import type { InAppPurchase } from '../InAppPurchase.ts';
import type { InAppPurchaseOfferCode } from '../InAppPurchaseOfferCode.ts';
import { CreateIAPOfferCodeModal } from './CreateIAPOfferCodeModal.tsx';

interface Props {
  iap: InAppPurchase;
}

function OfferCodeRow({ code }: { code: InAppPurchaseOfferCode }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deactivate = async () => {
    if (!code.canDeactivate) return;
    if (!window.confirm(`Deactivate "${code.name}"?`)) return;
    setBusy(true);
    setError(null);
    try { await code.deactivate(); }
    catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <tr>
      <td className="cell-primary">{code.name}</td>
      <td>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {code.eligibilityLabels.length === 0
            ? <span className="muted">—</span>
            : code.eligibilityLabels.map((l) => (
                <span key={l} className="platform-badge">{l}</span>
              ))}
        </div>
      </td>
      <td>
        <span className={`status ${code.isActive ? 'live' : ''}`}>
          {code.isActive ? 'Active' : 'Inactive'}
        </span>
      </td>
      <td>{code.totalCodes.toLocaleString('en-US')}</td>
      <td>
        {code.canDeactivate && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={deactivate}
            disabled={busy}
          >
            {busy ? 'Deactivating…' : 'Deactivate'}
          </button>
        )}
        {error && (
          <div className="form-hint" style={{ color: 'var(--danger-text)', marginTop: 4 }}>{error}</div>
        )}
      </td>
    </tr>
  );
}

const ObservedOfferCodeRow = observer(OfferCodeRow);

function IAPOffersTabImpl({ iap }: Props) {
  const [createOpen, setCreateOpen] = useState(false);
  useEffect(() => {
    if (iap.isOfferCodesLoaded) return;
    void iap.loadOfferCodes().catch((err) => {
      console.warn('[iap] loadOfferCodes failed:', err);
    });
  }, [iap]);

  if (!iap.canViewOfferCodes) {
    return <div className="card-body"><span className="muted">Backend does not expose offer codes for this IAP.</span></div>;
  }
  if (!iap.isOfferCodesLoaded) {
    return <div className="loading"><span className="spinner" /><span>Loading offer codes…</span></div>;
  }

  return (
    <div className="card">
      <div className="toolbar">
        <div className="toolbar-left">
          <strong>Offer Codes</strong>
          <span className="muted" style={{ marginLeft: 8 }}>
            {iap.offerCodes.length} total · {iap.activeOfferCodeCount} active
          </span>
        </div>
        <div className="toolbar-right">
          {iap.canCreateOfferCode && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => setCreateOpen(true)}
            >
              + New Offer Code
            </button>
          )}
        </div>
      </div>
      {iap.offerCodes.length === 0 ? (
        <div className="card-body" style={{ textAlign: 'center', padding: 24 }}>
          <div style={{ fontSize: 28, opacity: 0.4 }}>🎟️</div>
          <p className="muted" style={{ marginTop: 8 }}>No offer codes for this IAP yet.</p>
        </div>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Eligibility</th>
                <th>Status</th>
                <th>Codes</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {iap.offerCodes.map((c) => (
                <ObservedOfferCodeRow key={c.id} code={c} />
              ))}
            </tbody>
          </table>
        </div>
      )}
      <CreateIAPOfferCodeModal iap={iap} open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}

export const IAPOffersTab = observer(IAPOffersTabImpl);
