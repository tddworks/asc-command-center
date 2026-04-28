import { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import type { Subscription } from '../Subscription.ts';
import type { SubscriptionOfferCode } from '../SubscriptionOffers.ts';
import { CreateIntroductoryOfferModal } from './CreateIntroductoryOfferModal.tsx';
import { CreatePromotionalOfferModal } from './CreatePromotionalOfferModal.tsx';
import { CreateSubscriptionOfferCodeModal } from './CreateSubscriptionOfferCodeModal.tsx';
import { SubscriptionOfferCodeDetail } from './SubscriptionOfferCodeDetail.tsx';
import { OffersSection } from '../../components/OffersSection.tsx';
import { EligibilityBadges } from '../../components/EligibilityBadges.tsx';

interface Props {
  sub: Subscription;
}

function SubscriptionOffersTabImpl({ sub }: Props) {
  const [createCodeOpen, setCreateCodeOpen] = useState(false);
  const [createIntroOpen, setCreateIntroOpen] = useState(false);
  const [createPromoOpen, setCreatePromoOpen] = useState(false);
  const [selectedCodeId, setSelectedCodeId] = useState<string | null>(null);

  const deleteIntro = async (offer: import('../SubscriptionOffers.ts').SubscriptionIntroductoryOffer) => {
    if (!window.confirm(`Delete intro offer "${offer.summaryLabel}"?`)) return;
    try { await sub.deleteIntroductoryOffer(offer); }
    catch (err) { console.warn('[subscription] delete intro offer failed:', err); }
  };
  const deletePromo = async (offer: import('../SubscriptionOffers.ts').SubscriptionPromotionalOffer) => {
    if (!window.confirm(`Delete promo offer "${offer.name}"?`)) return;
    try { await sub.deletePromotionalOffer(offer); }
    catch (err) { console.warn('[subscription] delete promo offer failed:', err); }
  };

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
    if (!sub.isWinBackOffersLoaded) {
      void sub.loadWinBackOffers().catch((err) => console.warn('[subscription] win-back offers failed:', err));
    }
  }, [sub]);

  // Drop the offer-code selection if the underlying code is no longer in
  // the list — happens after a refresh / data-mode swap.
  useEffect(() => {
    if (!selectedCodeId) return;
    if (!sub.offerCodes.some((c) => c.id === selectedCodeId)) {
      setSelectedCodeId(null);
    }
  }, [sub.offerCodes, selectedCodeId]);

  const selected: SubscriptionOfferCode | undefined = selectedCodeId
    ? sub.offerCodes.find((c) => c.id === selectedCodeId)
    : undefined;

  if (selected) {
    return (
      <SubscriptionOfferCodeDetail
        sub={sub}
        code={selected}
        onBack={() => setSelectedCodeId(null)}
      />
    );
  }

  const createCodeButton = (
    <button
      type="button"
      className="btn btn-primary btn-sm"
      onClick={() => setCreateCodeOpen(true)}
      disabled={!sub.canCreateOfferCode}
      title={
        sub.canCreateOfferCode
          ? 'Create a new offer code'
          : 'Backend does not allow creating an offer code for this subscription yet — set up localization, pricing, and submit for approval first.'
      }
    >
      + Create Offer Code
    </button>
  );

  return (
    <div>
      <OffersSection
        title="Introductory Offers"
        subtitle={sub.introductoryOffers.length}
        actions={sub.canCreateIntroductoryOffer && (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setCreateIntroOpen(true)}
          >
            + Add Intro Offer
          </button>
        )}
        isSupported={sub.canViewIntroductoryOffers}
        isLoaded={sub.isIntroductoryOffersLoaded}
        isEmpty={sub.introductoryOffers.length === 0}
        notSupportedMessage="Backend does not expose introductory offers."
        emptyMessage="No introductory offers yet."
      >
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Summary</th>
                <th>Territory</th>
                <th>Starts</th>
                <th>Ends</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sub.introductoryOffers.map((o) => (
                <tr key={o.id}>
                  <td className="cell-primary">{o.summaryLabel}</td>
                  <td className="cell-mono">{o.territory ?? '—'}</td>
                  <td>{o.startDate ?? '—'}</td>
                  <td>{o.endDate ?? '—'}</td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => deleteIntro(o)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </OffersSection>

      <OffersSection
        title="Promotional Offers"
        subtitle={sub.promotionalOffers.length}
        actions={sub.canCreatePromotionalOffer && (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setCreatePromoOpen(true)}
          >
            + Add Promo Offer
          </button>
        )}
        isSupported={sub.canViewPromotionalOffers}
        isLoaded={sub.isPromotionalOffersLoaded}
        isEmpty={sub.promotionalOffers.length === 0}
        notSupportedMessage="Backend does not expose promotional offers."
        emptyMessage="No promotional offers yet."
      >
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Identifier</th>
                <th>Summary</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sub.promotionalOffers.map((o) => (
                <tr key={o.id}>
                  <td className="cell-primary">{o.name}</td>
                  <td className="cell-mono">{o.identifier}</td>
                  <td>{o.summaryLabel}</td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => deletePromo(o)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </OffersSection>

      <OffersSection
        title="Win-back Offers"
        subtitle={sub.winBackOffers.length}
        actions={
          <span className="muted" style={{ fontSize: 12 }}>
            Read-only · create wizard ships in a later phase.
          </span>
        }
        isSupported={sub.isApproved && sub.canViewWinBackOffers}
        isLoaded={sub.isWinBackOffersLoaded}
        isEmpty={sub.winBackOffers.length === 0}
        notSupportedMessage={
          sub.isApproved
            ? 'Backend does not expose win-back offers.'
            : 'Win-back offers require an approved subscription.'
        }
        emptyMessage="No win-back offers yet."
      >
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Reference Name</th>
                <th>Summary</th>
                <th>Priority</th>
              </tr>
            </thead>
            <tbody>
              {sub.winBackOffers.map((o) => (
                <tr key={o.id}>
                  <td className="cell-primary">{o.referenceName}</td>
                  <td>{o.summaryLabel}</td>
                  <td><span className="platform-badge">{o.priorityLabel}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </OffersSection>

      <OffersSection
        title="Offer Codes"
        subtitle={sub.offerCodes.length}
        marginBottom={0}
        actions={createCodeButton}
        isSupported={sub.canViewOfferCodes}
        isLoaded={sub.isOfferCodesLoaded}
        isEmpty={sub.offerCodes.length === 0}
        notSupportedMessage="Backend does not expose offer codes."
        emptyTitle="No offer codes yet"
        emptyMessage={
          sub.canCreateOfferCode
            ? 'Generate redeemable codes to give subscribers free trials or discounts.'
            : 'Add a localization, set a base price, and submit the subscription for approval before creating offer codes.'
        }
        emptyDecoration={<div style={{ fontSize: 32, opacity: 0.4 }}>🎟️</div>}
        emptyCta={createCodeButton}
      >
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Eligibility</th>
                <th>Summary</th>
                <th>Status</th>
                <th>Codes</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sub.offerCodes.map((c) => (
                <tr
                  key={c.id}
                  style={{ cursor: 'pointer' }}
                  onClick={() => setSelectedCodeId(c.id)}
                >
                  <td className="cell-primary">{c.name}</td>
                  <td><EligibilityBadges labels={c.eligibilityLabels} /></td>
                  <td>{c.summaryLabel}</td>
                  <td>
                    <span className={`status ${c.isActive ? 'live' : ''}`}>
                      {c.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>{c.totalNumberOfCodes?.toLocaleString('en-US') ?? '—'}</td>
                  <td style={{ textAlign: 'right' }}>
                    <span className="muted" style={{ fontSize: 13 }}>›</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </OffersSection>

      <CreateSubscriptionOfferCodeModal sub={sub} open={createCodeOpen} onClose={() => setCreateCodeOpen(false)} />
      <CreateIntroductoryOfferModal sub={sub} open={createIntroOpen} onClose={() => setCreateIntroOpen(false)} />
      <CreatePromotionalOfferModal sub={sub} open={createPromoOpen} onClose={() => setCreatePromoOpen(false)} />
    </div>
  );
}

export const SubscriptionOffersTab = observer(SubscriptionOffersTabImpl);
