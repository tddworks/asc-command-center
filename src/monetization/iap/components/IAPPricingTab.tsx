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
        <div className="card" style={{ textAlign: 'center', padding: 32 }}>
          <div style={{ fontSize: 32, opacity: 0.4 }}>💰</div>
          <h4 style={{ marginTop: 8 }}>No price set</h4>
          <p className="muted" style={{ marginTop: 4 }}>
            Apple auto-equalises every territory once a base price is configured.
          </p>
          {iap.canSetPrice && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              style={{ marginTop: 12 }}
              onClick={() => setSetPriceOpen(true)}
            >
              Set Base Price
            </button>
          )}
        </div>
        <IAPPricePointPickerModal iap={iap} open={setPriceOpen} onClose={() => setSetPriceOpen(false)} />
      </>
    );
  }

  const rows = schedule.filteredTerritoryPrices(query);

  return (
    <>
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="toolbar">
          <div className="toolbar-left">
            <strong>⭐ Base Territory</strong>
            <span className="muted" style={{ marginLeft: 8 }}>
              {territoryFlag(schedule.baseTerritoryId)} {schedule.baseTerritoryName} · {schedule.basePrice} {schedule.baseCurrency}
            </span>
          </div>
          <div className="toolbar-right">
            {iap.canSetPrice && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setSetPriceOpen(true)}
              >
                Change Base
              </button>
            )}
          </div>
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
