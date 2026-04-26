import { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import type { Subscription } from '../Subscription.ts';
import { CreateSubscriptionOfferCodeModal } from './CreateSubscriptionOfferCodeModal.tsx';

interface Props {
  sub: Subscription;
}

function SubscriptionOffersTabImpl({ sub }: Props) {
  const [createCodeOpen, setCreateCodeOpen] = useState(false);
  useEffect(() => {
    if (!sub.isIntroductoryOffersLoaded) {
      void sub.loadIntroductoryOffers().catch((err) => console.warn('[subscription] intro offers failed:', err));
    }
    if (!sub.isPromotionalOffersLoaded) {
      void sub.loadPromotionalOffers().catch((err) => console.warn('[subscription] promo offers failed:', err));
    }
    if (!sub.isOfferCodesLoaded) {
      void sub.loadOfferCodes().catch((err) => console.warn('[subscription] offer codes failed:', err));
    }
  }, [sub]);

  return (
    <div>
      {/* Introductory Offers */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="toolbar">
          <div className="toolbar-left">
            <strong>Introductory Offers</strong>
            <span className="muted" style={{ marginLeft: 8 }}>
              {sub.introductoryOffers.length}
            </span>
          </div>
        </div>
        {!sub.canViewIntroductoryOffers ? (
          <div className="card-body"><span className="muted">Backend does not expose introductory offers.</span></div>
        ) : !sub.isIntroductoryOffersLoaded ? (
          <div className="card-body"><div className="loading"><span className="spinner" /><span>Loading…</span></div></div>
        ) : sub.introductoryOffers.length === 0 ? (
          <div className="card-body" style={{ textAlign: 'center', padding: 16 }}>
            <span className="muted">No introductory offers yet.</span>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Summary</th>
                  <th>Territory</th>
                  <th>Starts</th>
                  <th>Ends</th>
                </tr>
              </thead>
              <tbody>
                {sub.introductoryOffers.map((o) => (
                  <tr key={o.id}>
                    <td className="cell-primary">{o.summaryLabel}</td>
                    <td className="cell-mono">{o.territory ?? '—'}</td>
                    <td>{o.startDate ?? '—'}</td>
                    <td>{o.endDate ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Promotional Offers */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="toolbar">
          <div className="toolbar-left">
            <strong>Promotional Offers</strong>
            <span className="muted" style={{ marginLeft: 8 }}>
              {sub.promotionalOffers.length}
            </span>
          </div>
        </div>
        {!sub.canViewPromotionalOffers ? (
          <div className="card-body"><span className="muted">Backend does not expose promotional offers.</span></div>
        ) : !sub.isPromotionalOffersLoaded ? (
          <div className="card-body"><div className="loading"><span className="spinner" /><span>Loading…</span></div></div>
        ) : sub.promotionalOffers.length === 0 ? (
          <div className="card-body" style={{ textAlign: 'center', padding: 16 }}>
            <span className="muted">No promotional offers yet.</span>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Identifier</th>
                  <th>Summary</th>
                </tr>
              </thead>
              <tbody>
                {sub.promotionalOffers.map((o) => (
                  <tr key={o.id}>
                    <td className="cell-primary">{o.name}</td>
                    <td className="cell-mono">{o.identifier}</td>
                    <td>{o.summaryLabel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Offer Codes */}
      <div className="card">
        <div className="toolbar">
          <div className="toolbar-left">
            <strong>Offer Codes</strong>
            <span className="muted" style={{ marginLeft: 8 }}>
              {sub.offerCodes.length}
            </span>
          </div>
          <div className="toolbar-right">
            {sub.canCreateOfferCode && (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => setCreateCodeOpen(true)}
              >
                + New Offer Code
              </button>
            )}
          </div>
        </div>
        {!sub.canViewOfferCodes ? (
          <div className="card-body"><span className="muted">Backend does not expose offer codes.</span></div>
        ) : !sub.isOfferCodesLoaded ? (
          <div className="card-body"><div className="loading"><span className="spinner" /><span>Loading…</span></div></div>
        ) : sub.offerCodes.length === 0 ? (
          <div className="card-body" style={{ textAlign: 'center', padding: 16 }}>
            <span className="muted">No offer codes yet.</span>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Eligibility</th>
                  <th>Summary</th>
                  <th>Status</th>
                  <th>Codes</th>
                </tr>
              </thead>
              <tbody>
                {sub.offerCodes.map((c) => (
                  <tr key={c.id}>
                    <td className="cell-primary">{c.name}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {c.eligibilityLabels.length === 0
                          ? <span className="muted">—</span>
                          : c.eligibilityLabels.map((l) => (
                              <span key={l} className="platform-badge">{l}</span>
                            ))}
                      </div>
                    </td>
                    <td>{c.summaryLabel}</td>
                    <td>
                      <span className={`status ${c.isActive ? 'live' : ''}`}>
                        {c.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>{c.totalNumberOfCodes?.toLocaleString('en-US') ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CreateSubscriptionOfferCodeModal sub={sub} open={createCodeOpen} onClose={() => setCreateCodeOpen(false)} />
    </div>
  );
}

export const SubscriptionOffersTab = observer(SubscriptionOffersTabImpl);
