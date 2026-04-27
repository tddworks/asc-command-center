import { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import type { InAppPurchase } from '../InAppPurchase.ts';
import { territoryFlag } from '../../../shared/territoryDirectory.ts';
import { TerritoryPriceTable } from '../../components/TerritoryPriceTable.tsx';
import { IAPPricePointPickerModal } from './IAPPricePointPickerModal.tsx';

interface Props {
  iap: InAppPurchase;
}

function IAPPricingTabImpl({ iap }: Props) {
  const [query, setQuery] = useState('');
  const [setPriceOpen, setSetPriceOpen] = useState(false);

  useEffect(() => {
    if (iap.isPriceScheduleLoaded) return;
    void iap.loadPriceSchedule().catch((err) => {
      console.warn('[iap] loadPriceSchedule failed:', err);
    });
  }, [iap]);

  if (!iap.canViewPricing) {
    return <div className="card-body"><span className="muted">Backend does not expose pricing for this IAP.</span></div>;
  }
  if (!iap.isPriceScheduleLoaded) {
    return <div className="loading"><span className="spinner" /><span>Loading pricing…</span></div>;
  }

  const schedule = iap.priceSchedule;
  if (!schedule) {
    return (
      <>
        <div className="card">
          <div className="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.59 13.41L13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
              <line x1="7" y1="7" x2="7.01" y2="7"/>
              <line x1="2" y1="2" x2="22" y2="22"/>
            </svg>
            <h3>No Price Set</h3>
            <p>
              This in-app purchase doesn't have a price yet. Select a base territory and set a price to get started.
            </p>
            <div style={{ width: '100%', maxWidth: 320, margin: '0 auto' }}>
              <button
                type="button"
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center', padding: '12px 16px', fontWeight: 600 }}
                onClick={() => setSetPriceOpen(true)}
              >
                Select Base Territory
              </button>
              <p className="muted" style={{ fontSize: 11, marginTop: 8, marginBottom: 0 }}>
                Apple will auto-generate prices for all territories
              </p>
            </div>
          </div>
        </div>
        <IAPPricePointPickerModal iap={iap} open={setPriceOpen} onClose={() => setSetPriceOpen(false)} />
      </>
    );
  }

  const rows = schedule.filteredTerritoryPrices(query);
  const baseCardClickable = iap.canSetPrice;

  return (
    <>
      <div
        className="card"
        style={{
          marginBottom: 12,
          background:
            'linear-gradient(135deg, color-mix(in srgb, var(--accent) 8%, transparent), color-mix(in srgb, var(--accent) 4%, transparent))',
          border: '1px solid color-mix(in srgb, var(--accent) 18%, var(--border))',
          cursor: baseCardClickable ? 'pointer' : 'default',
        }}
        onClick={() => { if (baseCardClickable) setSetPriceOpen(true); }}
        role={baseCardClickable ? 'button' : undefined}
        tabIndex={baseCardClickable ? 0 : undefined}
        onKeyDown={(e) => {
          if (!baseCardClickable) return;
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSetPriceOpen(true); }
        }}
      >
        <div className="toolbar">
          <div className="toolbar-left" style={{ gap: 12 }}>
            <span aria-hidden="true">⭐</span>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span className="muted" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Base Territory
              </span>
              <strong style={{ fontSize: 14 }}>
                {territoryFlag(schedule.baseTerritoryId)} {schedule.baseTerritoryName} · {schedule.basePrice} {schedule.baseCurrency}
              </strong>
            </div>
          </div>
          {baseCardClickable && (
            <div className="toolbar-right" style={{ color: 'var(--accent-text, var(--accent))', fontSize: 12, fontWeight: 600 }}>
              ↻ Change Base
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="toolbar">
          <div className="toolbar-left">
            <input
              type="search"
              className="form-input"
              style={{ minWidth: 240 }}
              placeholder="Search territories, currency, price…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="toolbar-right">
            <span className="muted">
              {rows.length}/{schedule.territoryCount} territories
            </span>
          </div>
        </div>
        <TerritoryPriceTable
          prices={rows}
          highlightTerritoryId={schedule.baseTerritoryId}
          highlightLabel="BASE"
        />
      </div>

      <IAPPricePointPickerModal iap={iap} open={setPriceOpen} onClose={() => setSetPriceOpen(false)} />
    </>
  );
}

export const IAPPricingTab = observer(IAPPricingTabImpl);
