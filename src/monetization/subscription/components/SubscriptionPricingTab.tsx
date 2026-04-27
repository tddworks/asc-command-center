import { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import type { Subscription } from '../Subscription.ts';
import { TerritoryPriceTable } from '../../components/TerritoryPriceTable.tsx';
import { SubscriptionPricePointPickerModal } from './SubscriptionPricePointPickerModal.tsx';

interface Props {
  sub: Subscription;
}

function SubscriptionPricingTabImpl({ sub }: Props) {
  const [query, setQuery] = useState('');
  const [setPriceOpen, setSetPriceOpen] = useState(false);

  useEffect(() => {
    if (sub.isPriceScheduleLoaded) return;
    void sub.loadPriceSchedule().catch((err) => {
      console.warn('[subscription] loadPriceSchedule failed:', err);
    });
  }, [sub]);

  if (!sub.canViewPricing) {
    return <div className="card-body"><span className="muted">Backend does not expose pricing for this tier.</span></div>;
  }
  if (!sub.isPriceScheduleLoaded) {
    return <div className="loading"><span className="spinner" /><span>Loading pricing…</span></div>;
  }

  const schedule = sub.priceSchedule;
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
              Set up a starting subscription price. Once created, you can set up an introductory or promotional offer.
            </p>
            <div style={{ width: '100%', maxWidth: 320, margin: '0 auto' }}>
              <button
                type="button"
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center', padding: '12px 16px', fontWeight: 600 }}
                onClick={() => setSetPriceOpen(true)}
              >
                Add Subscription Price
              </button>
              <p className="muted" style={{ fontSize: 11, marginTop: 8, marginBottom: 0 }}>
                Apple will auto-equalize prices for all territories
              </p>
            </div>
          </div>
        </div>
        <SubscriptionPricePointPickerModal sub={sub} open={setPriceOpen} onClose={() => setSetPriceOpen(false)} />
      </>
    );
  }

  const rows = schedule.filteredTerritoryPrices(query);

  return (
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
        <div className="toolbar-right" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span className="muted">{rows.length}/{schedule.territoryCount} territories</span>
          {sub.canSetPrices && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setSetPriceOpen(true)}
            >
              Change Price
            </button>
          )}
        </div>
      </div>
      <TerritoryPriceTable prices={rows} />
      <SubscriptionPricePointPickerModal sub={sub} open={setPriceOpen} onClose={() => setSetPriceOpen(false)} />
    </div>
  );
}

export const SubscriptionPricingTab = observer(SubscriptionPricingTabImpl);
