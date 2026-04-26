import { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import type { InAppPurchase } from '../InAppPurchase.ts';

interface Props {
  iap: InAppPurchase;
}

function IAPPricingTabImpl({ iap }: Props) {
  const [query, setQuery] = useState('');

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
      <div className="card" style={{ textAlign: 'center', padding: 32 }}>
        <div style={{ fontSize: 32, opacity: 0.4 }}>💰</div>
        <h4 style={{ marginTop: 8 }}>No price set</h4>
        <p className="muted" style={{ marginTop: 4 }}>
          Apple auto-generates equalised prices once you set a base territory price.
          The setup wizard ships in the next phase.
        </p>
      </div>
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
              {schedule.baseTerritoryName} · {schedule.basePrice} {schedule.baseCurrency}
            </span>
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
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Territory</th>
                <th>ID</th>
                <th>Currency</th>
                <th>Price</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={4} className="muted" style={{ textAlign: 'center', padding: 16 }}>No matching territories.</td></tr>
              ) : rows.map((p) => (
                <tr key={p.territoryId}>
                  <td className="cell-primary">
                    {p.territoryName}
                    {p.territoryId === schedule.baseTerritoryId && (
                      <span className="platform-badge" style={{ marginLeft: 6 }}>BASE</span>
                    )}
                  </td>
                  <td className="cell-mono">{p.territoryId}</td>
                  <td>{p.currency}</td>
                  <td>{p.formattedPrice}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

export const IAPPricingTab = observer(IAPPricingTabImpl);
