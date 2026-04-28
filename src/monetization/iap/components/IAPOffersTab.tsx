import { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import type { InAppPurchase } from '../InAppPurchase.ts';
import type { InAppPurchaseOfferCode } from '../InAppPurchaseOfferCode.ts';
import { CreateIAPOfferCodeModal } from './CreateIAPOfferCodeModal.tsx';
import { IAPOfferCodeDetail } from './IAPOfferCodeDetail.tsx';
import { OffersSection } from '../../components/OffersSection.tsx';
import { EligibilityBadges } from '../../components/EligibilityBadges.tsx';

interface Props {
  iap: InAppPurchase;
}

function IAPOffersTabImpl({ iap }: Props) {
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (iap.isOfferCodesLoaded) return;
    void iap.loadOfferCodes().catch((err) => {
      console.warn('[iap] loadOfferCodes failed:', err);
    });
  }, [iap]);

  // Drop the selection if the underlying code is no longer in the list —
  // happens after a refresh / data-mode swap so we don't strand the
  // detail view on a deleted offer code.
  useEffect(() => {
    if (!selectedId) return;
    if (!iap.offerCodes.some((c) => c.id === selectedId)) {
      setSelectedId(null);
    }
  }, [iap.offerCodes, selectedId]);

  const selected: InAppPurchaseOfferCode | undefined = selectedId
    ? iap.offerCodes.find((c) => c.id === selectedId)
    : undefined;

  if (selected) {
    return (
      <IAPOfferCodeDetail
        iap={iap}
        code={selected}
        onBack={() => setSelectedId(null)}
      />
    );
  }

  const createButton = (
    <button
      type="button"
      className="btn btn-primary btn-sm"
      onClick={() => setCreateOpen(true)}
      disabled={!iap.canCreateOfferCode}
      title={
        iap.canCreateOfferCode
          ? 'Create a new offer code'
          : 'Backend does not allow creating an offer code for this IAP yet — set up localization, pricing, and submit for approval first.'
      }
    >
      + Create Offer Code
    </button>
  );

  return (
    <>
      <OffersSection
        title="Offer Codes"
        subtitle={`${iap.offerCodes.length} total · ${iap.activeOfferCodeCount} active`}
        actions={createButton}
        isSupported={iap.canViewOfferCodes}
        isLoaded={iap.isOfferCodesLoaded}
        isEmpty={iap.offerCodes.length === 0}
        notSupportedMessage="Backend does not expose offer codes for this IAP."
        emptyTitle="No offer codes yet"
        emptyMessage={
          iap.canCreateOfferCode
            ? 'Generate redeemable codes to give customers free or discounted access.'
            : 'Add a localization, set a base price, and submit the IAP for approval before creating offer codes.'
        }
        emptyDecoration={<div style={{ fontSize: 32, opacity: 0.4 }}>🎟️</div>}
        emptyCta={createButton}
      >
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Eligibility</th>
                <th>Status</th>
                <th>Codes</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {iap.offerCodes.map((c) => (
                <tr
                  key={c.id}
                  style={{ cursor: 'pointer' }}
                  onClick={() => setSelectedId(c.id)}
                >
                  <td className="cell-primary">{c.name}</td>
                  <td><EligibilityBadges labels={c.eligibilityLabels} /></td>
                  <td>
                    <span className={`status ${c.isActive ? 'live' : ''}`}>
                      {c.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>{c.totalCodes.toLocaleString('en-US')}</td>
                  <td style={{ textAlign: 'right' }}>
                    <span className="muted" style={{ fontSize: 13 }}>›</span>
                  </td>
                </tr>
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
