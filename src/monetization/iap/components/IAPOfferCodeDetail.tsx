import { useEffect, useMemo, useState } from 'react';
import { observer } from 'mobx-react-lite';
import type { InAppPurchase } from '../InAppPurchase.ts';
import type { InAppPurchaseOfferCode } from '../InAppPurchaseOfferCode.ts';
import type { IAPOneTimeUseCodeBatch } from '../OneTimeUseCodeBatch.ts';
import { CodeEnvironment } from '../OneTimeUseCodeBatch.ts';
import { EligibilityBadges } from '../../components/EligibilityBadges.tsx';
import { IAPGenerateOneTimeCodesModal } from './IAPGenerateOneTimeCodesModal.tsx';
import { IAPCustomCodesModal } from './IAPCustomCodesModal.tsx';
import { RedeemCodesModal } from '../../components/RedeemCodesModal.tsx';

interface Props {
  iap: InAppPurchase;
  code: InAppPurchaseOfferCode;
  onBack: () => void;
}

const SECTION_GAP = 16;
const CARD_STYLE: React.CSSProperties = {
  padding: 16,
  border: '1px solid var(--border)',
  borderRadius: 12,
  background: 'var(--bg-elevated, var(--card-bg, var(--bg)))',
};

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
        padding: '10px 0',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <span className="muted" style={{ fontSize: 13 }}>{label}</span>
      <div style={{ fontSize: 14, textAlign: 'right' }}>{children}</div>
    </div>
  );
}

function SectionHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
      <div>
        <strong>{title}</strong>
        {subtitle && <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{subtitle}</div>}
      </div>
      {action}
    </div>
  );
}

function BatchTable({
  batches,
  downloadingId,
  onDownload,
}: {
  batches: IAPOneTimeUseCodeBatch[];
  downloadingId: string | null;
  onDownload: (batch: IAPOneTimeUseCodeBatch) => void;
}) {
  if (batches.length === 0) {
    return (
      <div className="card-body" style={{ textAlign: 'center', padding: 16 }}>
        <span className="muted">No batches yet.</span>
      </div>
    );
  }
  return (
    <div className="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Codes</th>
            <th>Created</th>
            <th>Expires</th>
            <th>Created by</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {batches.map((b) => (
            <tr key={b.id}>
              <td>{b.numberOfCodes.toLocaleString('en-US')}</td>
              <td className="muted">{b.createdDate ?? '—'}</td>
              <td className="muted">{b.expirationDate ?? '—'}</td>
              <td className="muted">{b.createdBy ?? '—'}</td>
              <td>
                <span className={`status ${b.isActive ? 'live' : ''}`}>
                  {b.isActive ? 'Active' : 'Inactive'}
                </span>
              </td>
              <td style={{ textAlign: 'right' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => onDownload(b)}
                  disabled={downloadingId === b.id}
                >
                  {downloadingId === b.id ? 'Downloading…' : 'Download CSV'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function IAPOfferCodeDetailImpl({ iap, code, onBack }: Props) {
  const [generateOpen, setGenerateOpen] = useState<CodeEnvironment | null>(null);
  const [customOpen, setCustomOpen] = useState(false);
  const [downloadedCsv, setDownloadedCsv] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [urlCopied, setUrlCopied] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const productionBatches = useMemo(
    () => code.oneTimeUseCodes.filter((b) => b.environment !== CodeEnvironment.Sandbox),
    [code.oneTimeUseCodes],
  );
  const sandboxBatches = useMemo(
    () => code.oneTimeUseCodes.filter((b) => b.environment === CodeEnvironment.Sandbox),
    [code.oneTimeUseCodes],
  );

  const copyRedemptionUrl = async () => {
    try {
      await navigator.clipboard.writeText(code.redemptionUrl);
      setUrlCopied(true);
      setTimeout(() => setUrlCopied(false), 2000);
    } catch (err) {
      console.warn('[iap-offer-code] copy URL failed:', err);
    }
  };

  const handleDownload = async (batch: IAPOneTimeUseCodeBatch) => {
    setDownloadingId(batch.id); setError(null);
    try {
      const csv = await code.downloadCodes(batch);
      setDownloadedCsv(csv);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDeactivate = async () => {
    if (!code.canDeactivate) return;
    if (!window.confirm(`Deactivate "${code.name}"? Existing codes can no longer be redeemed.`)) return;
    setDeactivating(true); setError(null);
    try {
      await code.deactivate();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDeactivating(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SECTION_GAP }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button type="button" className="btn btn-secondary btn-sm" onClick={onBack}>
          ← Back
        </button>
        <div style={{ flex: 1 }}>
          <h3 style={{ margin: 0 }}>{code.name}</h3>
          <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
            Offer code · {iap.referenceName}
          </div>
        </div>
        <span className={`status ${code.isActive ? 'live' : ''}`}>
          {code.isActive ? 'Active' : 'Inactive'}
        </span>
      </div>

      {error && (
        <div className="card-body" style={{ color: 'var(--danger-text)', fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* Code Info */}
      <div style={CARD_STYLE}>
        <SectionHeader title="Code info" />
        <div>
          <InfoRow label="Reference name">{code.name}</InfoRow>
          <InfoRow label="Eligibility">
            <EligibilityBadges labels={code.eligibilityLabels} />
          </InfoRow>
          {code.productionCodeCount !== null && (
            <InfoRow label="Production codes">
              {code.productionCodeCount.toLocaleString('en-US')}
            </InfoRow>
          )}
          {code.sandboxCodeCount !== null && (
            <InfoRow label="Sandbox codes">
              {code.sandboxCodeCount.toLocaleString('en-US')}
            </InfoRow>
          )}
        </div>
      </div>

      {/* Redemption URL */}
      <div style={CARD_STYLE}>
        <SectionHeader
          title="Redemption URL template"
          subtitle="Replace CODE with a real redeemable code, then share with customers."
        />
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <code
            style={{
              flex: 1,
              padding: '8px 10px',
              border: '1px solid var(--border)',
              borderRadius: 8,
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              fontSize: 12,
              overflowX: 'auto',
              whiteSpace: 'nowrap',
            }}
          >
            {code.redemptionUrl}
          </code>
          <button type="button" className="btn btn-secondary btn-sm" onClick={copyRedemptionUrl}>
            {urlCopied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>

      {/* One-Time Use Codes (production) */}
      <div style={CARD_STYLE}>
        <SectionHeader
          title="One-time-use codes"
          subtitle="Generate batches of unique codes — each redeemable by a single customer. Use these for promotions, partner rewards, or press kits."
          action={(
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => setGenerateOpen(CodeEnvironment.Production)}
            >
              + Generate
            </button>
          )}
        />
        {!code.isOneTimeUseCodesLoaded ? (
          <div className="loading"><span className="spinner" /><span>Loading batches…</span></div>
        ) : (
          <BatchTable
            batches={productionBatches}
            downloadingId={downloadingId}
            onDownload={handleDownload}
          />
        )}
      </div>

      {/* Custom Codes */}
      <div style={CARD_STYLE}>
        <SectionHeader
          title="Custom codes"
          subtitle="Use developer-defined strings like BLACKFRIDAY26 — each code supports many redemptions."
          action={(
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setCustomOpen(true)}
            >
              Manage…
            </button>
          )}
        />
        <InfoRow label="Codes">
          {code.isCustomCodesLoaded
            ? `${code.customCodes.length} code${code.customCodes.length === 1 ? '' : 's'}`
            : 'Loading…'}
        </InfoRow>
        <InfoRow label="Total redemptions">
          {code.isCustomCodesLoaded
            ? code.totalCustomCodes.toLocaleString('en-US')
            : '—'}
        </InfoRow>
      </div>

      {/* Sandbox Codes */}
      <div style={CARD_STYLE}>
        <SectionHeader
          title="Sandbox codes"
          subtitle="Test the redemption flow with sandbox testers without spending production budget."
          action={(
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setGenerateOpen(CodeEnvironment.Sandbox)}
            >
              + Generate sandbox
            </button>
          )}
        />
        {!code.isOneTimeUseCodesLoaded ? (
          <div className="loading"><span className="spinner" /><span>Loading batches…</span></div>
        ) : (
          <BatchTable
            batches={sandboxBatches}
            downloadingId={downloadingId}
            onDownload={handleDownload}
          />
        )}
      </div>

      {/* Deactivate */}
      {code.canDeactivate && (
        <div style={CARD_STYLE}>
          <SectionHeader
            title="Deactivate"
            subtitle="Stops new redemptions immediately. This cannot be undone — already-redeemed codes remain valid."
          />
          <button
            type="button"
            className="btn btn-secondary"
            style={{ color: 'var(--danger-text)' }}
            onClick={handleDeactivate}
            disabled={deactivating}
          >
            {deactivating ? 'Deactivating…' : 'Deactivate offer code'}
          </button>
        </div>
      )}

      {/* Modals */}
      <IAPGenerateOneTimeCodesModal
        code={code}
        environment={generateOpen ?? CodeEnvironment.Production}
        open={generateOpen !== null}
        onClose={() => setGenerateOpen(null)}
      />
      <IAPCustomCodesModal
        code={code}
        open={customOpen}
        onClose={() => setCustomOpen(false)}
      />
      <RedeemCodesModal
        codes={downloadedCsv}
        offerCodeName={code.name}
        onClose={() => setDownloadedCsv(null)}
      />
    </div>
  );
}

export const IAPOfferCodeDetail = observer(IAPOfferCodeDetailImpl);
