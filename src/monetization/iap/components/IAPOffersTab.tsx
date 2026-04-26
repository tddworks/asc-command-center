import { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import type { InAppPurchase } from '../InAppPurchase.ts';
import type { InAppPurchaseOfferCode } from '../InAppPurchaseOfferCode.ts';
import { CodeEnvironment } from '../OneTimeUseCodeBatch.ts';
import { CreateIAPOfferCodeModal } from './CreateIAPOfferCodeModal.tsx';

interface Props {
  iap: InAppPurchase;
}

function BatchPanel({ code }: { code: InAppPurchaseOfferCode }) {
  const [genCount, setGenCount] = useState(100);
  const [genEnv, setGenEnv] = useState<CodeEnvironment>(CodeEnvironment.Production);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (code.isOneTimeUseCodesLoaded) return;
    void code.loadOneTimeUseCodes().catch((err) => {
      console.warn('[iap-offer-code] loadOneTimeUseCodes failed:', err);
    });
  }, [code]);

  const generate = async () => {
    setBusy(true); setError(null);
    try {
      await code.generateOneTimeUseCodes({ count: genCount, environment: genEnv });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <td colSpan={5} style={{ padding: 12, background: 'var(--bg)' }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
        <strong>One-time-use code batches</strong>
        <span className="muted" style={{ marginLeft: 4 }}>
          {code.oneTimeUseCodes.length} batch(es) · {code.totalOneTimeUseCodes.toLocaleString('en-US')} codes
        </span>
        <span style={{ flex: 1 }} />
        <input
          type="number"
          className="form-input"
          style={{ width: 100 }}
          min={1}
          value={genCount}
          onChange={(e) => setGenCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
        />
        <select
          className="form-input"
          style={{ width: 140 }}
          value={genEnv}
          onChange={(e) => setGenEnv(e.target.value as CodeEnvironment)}
        >
          <option value={CodeEnvironment.Production}>Production</option>
          <option value={CodeEnvironment.Sandbox}>Sandbox</option>
        </select>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={generate}
          disabled={busy}
        >
          {busy ? 'Generating…' : 'Generate'}
        </button>
      </div>
      {!code.isOneTimeUseCodesLoaded ? (
        <div className="loading"><span className="spinner" /><span>Loading batches…</span></div>
      ) : code.oneTimeUseCodes.length === 0 ? (
        <span className="muted">No batches yet.</span>
      ) : (
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Codes</th>
              <th>Environment</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {code.oneTimeUseCodes.map((b) => (
              <tr key={b.id}>
                <td className="cell-mono">{b.id}</td>
                <td>{b.numberOfCodes.toLocaleString('en-US')}</td>
                <td><span className="platform-badge">{b.environmentLabel}</span></td>
                <td>{b.createdDate ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {error && (
        <div className="form-hint" style={{ color: 'var(--danger-text)', marginTop: 4 }}>{error}</div>
      )}
    </td>
  );
}

const ObservedBatchPanel = observer(BatchPanel);

function OfferCodeRow({ code }: { code: InAppPurchaseOfferCode }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

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
    <>
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
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setOpen((v) => !v)}
            >
              {open ? 'Hide Batches' : 'Batches'}
            </button>
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
          </div>
          {error && (
            <div className="form-hint" style={{ color: 'var(--danger-text)', marginTop: 4 }}>{error}</div>
          )}
        </td>
      </tr>
      {open && (
        <tr>
          <ObservedBatchPanel code={code} />
        </tr>
      )}
    </>
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
