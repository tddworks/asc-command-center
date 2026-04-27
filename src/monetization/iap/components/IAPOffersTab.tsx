import { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import type { InAppPurchase } from '../InAppPurchase.ts';
import type { InAppPurchaseOfferCode } from '../InAppPurchaseOfferCode.ts';
import { CodeEnvironment } from '../OneTimeUseCodeBatch.ts';
import { CreateIAPOfferCodeModal } from './CreateIAPOfferCodeModal.tsx';
import { OffersSection } from '../../components/OffersSection.tsx';
import { EligibilityBadges } from '../../components/EligibilityBadges.tsx';

interface Props {
  iap: InAppPurchase;
}

function BatchPanel({ code }: { code: InAppPurchaseOfferCode }) {
  const [genCount, setGenCount] = useState(100);
  const [genEnv, setGenEnv] = useState<CodeEnvironment>(CodeEnvironment.Production);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [customCodeStr, setCustomCodeStr] = useState('');
  const [customCount, setCustomCount] = useState(100);
  const [customExp, setCustomExp] = useState('');
  const [customBusy, setCustomBusy] = useState(false);
  const [customError, setCustomError] = useState<string | null>(null);

  const [urlCopied, setUrlCopied] = useState(false);

  useEffect(() => {
    if (!code.isOneTimeUseCodesLoaded) {
      void code.loadOneTimeUseCodes().catch((err) => {
        console.warn('[iap-offer-code] loadOneTimeUseCodes failed:', err);
      });
    }
    if (!code.isCustomCodesLoaded) {
      void code.loadCustomCodes().catch((err) => {
        console.warn('[iap-offer-code] loadCustomCodes failed:', err);
      });
    }
  }, [code]);

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(code.redemptionUrl);
      setUrlCopied(true);
      setTimeout(() => setUrlCopied(false), 2000);
    } catch (err) {
      console.warn('[iap-offer-code] copy failed:', err);
    }
  };

  const createCustomCode = async () => {
    const customCodeTrimmed = customCodeStr.trim();
    if (!customCodeTrimmed || customCount < 1) return;
    setCustomBusy(true); setCustomError(null);
    try {
      await code.createCustomCode({
        customCode: customCodeTrimmed,
        numberOfCodes: customCount,
        expirationDate: customExp || null,
      });
      setCustomCodeStr('');
      setCustomCount(100);
      setCustomExp('');
    } catch (err) {
      setCustomError((err as Error).message);
    } finally {
      setCustomBusy(false);
    }
  };

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
      {/* Redemption URL */}
      <div style={{ marginBottom: 12 }}>
        <strong>Redemption URL</strong>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4 }}>
          <code
            style={{
              flex: 1, padding: '6px 8px', border: '1px solid var(--border)',
              borderRadius: 6, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              overflow: 'auto', whiteSpace: 'nowrap',
            }}
          >
            {code.redemptionUrl}
          </code>
          <button type="button" className="btn btn-secondary btn-sm" onClick={copyUrl}>
            {urlCopied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>

      {/* One-time-use batches */}
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

      {/* Custom codes */}
      <div style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
          <strong>Custom codes</strong>
          <span className="muted" style={{ marginLeft: 4 }}>
            {code.customCodes.length} code(s) · {code.totalCustomCodes.toLocaleString('en-US')} redemptions
          </span>
        </div>

        <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
          <input
            type="text"
            className="form-input"
            style={{ flex: 1, minWidth: 160, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}
            placeholder="e.g. BLACKFRIDAY2026"
            value={customCodeStr}
            onChange={(e) => setCustomCodeStr(e.target.value)}
          />
          <input
            type="number"
            className="form-input"
            style={{ width: 100 }}
            min={1}
            value={customCount}
            onChange={(e) => setCustomCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
            placeholder="Redemptions"
          />
          <input
            type="date"
            className="form-input"
            style={{ width: 160 }}
            value={customExp}
            onChange={(e) => setCustomExp(e.target.value)}
          />
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={createCustomCode}
            disabled={customBusy || !customCodeStr.trim()}
          >
            {customBusy ? 'Creating…' : 'Add'}
          </button>
        </div>

        {!code.isCustomCodesLoaded ? (
          <div className="loading"><span className="spinner" /><span>Loading custom codes…</span></div>
        ) : code.customCodes.length === 0 ? (
          <span className="muted">No custom codes yet.</span>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Max Redemptions</th>
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
        )}

        {customError && (
          <div className="form-hint" style={{ color: 'var(--danger-text)', marginTop: 4 }}>{customError}</div>
        )}
      </div>
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
        <td><EligibilityBadges labels={code.eligibilityLabels} /></td>
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

  return (
    <>
      <OffersSection
        title="Offer Codes"
        subtitle={`${iap.offerCodes.length} total · ${iap.activeOfferCodeCount} active`}
        actions={iap.canCreateOfferCode && (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setCreateOpen(true)}
          >
            + New Offer Code
          </button>
        )}
        isSupported={iap.canViewOfferCodes}
        isLoaded={iap.isOfferCodesLoaded}
        isEmpty={iap.offerCodes.length === 0}
        notSupportedMessage="Backend does not expose offer codes for this IAP."
        emptyMessage="No offer codes for this IAP yet."
        emptyDecoration={<div style={{ fontSize: 28, opacity: 0.4 }}>🎟️</div>}
      >
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
      </OffersSection>
      <CreateIAPOfferCodeModal iap={iap} open={createOpen} onClose={() => setCreateOpen(false)} />
    </>
  );
}

export const IAPOffersTab = observer(IAPOffersTabImpl);
