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
        <div className="card" style={{ textAlign: 'center', padding: 32 }}>
          <div style={{ fontSize: 32, opacity: 0.4 }}>💰</div>
          <h4 style={{ marginTop: 8 }}>No price set</h4>
          <p className="muted" style={{ marginTop: 4 }}>
            Apple auto-equalises every territory once an anchor price is configured.
          </p>
          {sub.canSetPrices && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              style={{ marginTop: 12 }}
              onClick={() => setSetPriceOpen(true)}
            >
              Set Price
            </button>
          )}
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
