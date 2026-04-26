import { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import type { InAppPurchase } from '../InAppPurchase.ts';
import { iaps } from '../iapsInstance.ts';
import { IAPAvailabilityTab } from './IAPAvailabilityTab.tsx';
import { IAPLocalizationsTab } from './IAPLocalizationsTab.tsx';
import { IAPOffersTab } from './IAPOffersTab.tsx';
import { IAPPricingTab } from './IAPPricingTab.tsx';
import { IAPReviewTab } from './IAPReviewTab.tsx';

const STATUS_CLASS: Record<string, string> = {
  success: 'live',
  info: 'pending',
  warning: 'pending',
  danger: 'rejected',
  neutral: '',
};

type TabKey = 'localizations' | 'pricing' | 'availability' | 'review' | 'offers';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'localizations', label: 'Localizations' },
  { key: 'pricing', label: 'Pricing' },
  { key: 'availability', label: 'Availability' },
  { key: 'review', label: 'Review' },
  { key: 'offers', label: 'Offers' },
];

interface Props {
  iap: InAppPurchase;
}

function IAPDetailImpl({ iap }: Props) {
  const [tab, setTab] = useState<TabKey>('localizations');
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Lazy-load localizations the first time the page sees this IAP.
  // Skipped if the affordance is missing — `loadLocalizations` short-
  // circuits and flips `isLocalizationsLoaded` so the tab can show its
  // "no affordance" copy instead of spinning forever.
  useEffect(() => {
    if (iap.isLocalizationsLoaded) return;
    void iap.loadLocalizations().catch((err) => {
      console.warn('[iap] loadLocalizations failed:', err);
    });
  }, [iap]);

  const back = () => iaps.clearSelection();

  const submit = async () => {
    setSubmitError(null);
    try { await iap.submit(); }
    catch (err) { setSubmitError((err as Error).message); }
  };
  const unsubmit = async () => {
    setSubmitError(null);
    try { await iap.unsubmit(); }
    catch (err) { setSubmitError((err as Error).message); }
  };

  return (
    <div>
      {/* Sticky header — name, productId, badges, primary action */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="toolbar" style={{ alignItems: 'flex-start' }}>
          <div className="toolbar-left" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={back} style={{ marginBottom: 4 }}>
              ← Back to list
            </button>
            <h3 style={{ margin: 0 }}>{iap.referenceName}</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="cell-mono">{iap.productId}</span>
              <span className="platform-badge">{iap.displayType}</span>
              <span className={`status ${STATUS_CLASS[iap.statusTone]}`}>{iap.statusLabel}</span>
            </div>
          </div>
          <div className="toolbar-right" style={{ display: 'flex', gap: 6 }}>
            {iap.canSubmit && (
              <button type="button" className="btn btn-primary btn-sm" onClick={submit}>Submit for Review</button>
            )}
            {iap.canUnsubmit && (
              <button type="button" className="btn btn-secondary btn-sm" onClick={unsubmit}>Cancel Submission</button>
            )}
          </div>
        </div>
        {submitError && (
          <div className="card-body" style={{ paddingTop: 0 }}>
            <span className="form-hint" style={{ color: 'var(--danger-text)' }}>{submitError}</span>
          </div>
        )}
        {iap.canSubmit && !iap.hasAnyCompleteLocalization && (
          <div className="card-body" style={{ paddingTop: 0 }}>
            <span className="form-hint" style={{ color: 'var(--danger-text)' }}>
              Add at least one localization with a display name before submitting for review.
            </span>
          </div>
        )}
      </div>

      {/* Tab nav */}
      <div className="card" style={{ marginBottom: 12, padding: 0 }}>
        <div role="tablist" style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              style={{
                background: 'transparent',
                border: 'none',
                padding: '10px 16px',
                cursor: 'pointer',
                color: tab === t.key ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontWeight: tab === t.key ? 600 : 500,
                borderBottom: tab === t.key ? '2px solid var(--accent)' : '2px solid transparent',
                marginBottom: -1,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab body */}
      {tab === 'localizations' && <IAPLocalizationsTab iap={iap} />}
      {tab === 'pricing' && <IAPPricingTab iap={iap} />}
      {tab === 'availability' && <IAPAvailabilityTab iap={iap} />}
      {tab === 'review' && <IAPReviewTab iap={iap} />}
      {tab === 'offers' && <IAPOffersTab iap={iap} />}
    </div>
  );
}

export const IAPDetail = observer(IAPDetailImpl);
