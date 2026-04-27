import { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import type { InAppPurchase } from '../InAppPurchase.ts';
import { iaps } from '../iapsInstance.ts';
import { IAPAvailabilityTab } from './IAPAvailabilityTab.tsx';
import { IAPLocalizationsTab } from './IAPLocalizationsTab.tsx';
import { IAPOffersTab } from './IAPOffersTab.tsx';
import { IAPPricingTab } from './IAPPricingTab.tsx';
import { IAPReviewTab } from './IAPReviewTab.tsx';
import { ProductDetailHeader, type StatusTone } from '../../components/ProductDetailHeader.tsx';
import { ProductTabBar } from '../../components/ProductTabBar.tsx';
import { NeedsAttentionBanner } from '../../components/NeedsAttentionBanner.tsx';

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

  useEffect(() => {
    if (iap.isLocalizationsLoaded) return;
    void iap.loadLocalizations().catch((err) => {
      console.warn('[iap] loadLocalizations failed:', err);
    });
  }, [iap]);

  const submitHint =
    iap.canSubmit && !iap.hasAnyCompleteLocalization
      ? 'Add at least one localization with a display name before submitting for review.'
      : null;

  return (
    <div>
      <ProductDetailHeader
        backLabel="Back to list"
        onBack={() => iaps.clearSelection()}
        name={iap.referenceName}
        canEditName={iap.canUpdate}
        onRenameSave={(next) => iap.update({ referenceName: next })}
        renamePlaceholder="Internal reference name"
        productId={iap.productId}
        badges={<span className="platform-badge">{iap.displayType}</span>}
        statusLabel={iap.statusLabel}
        statusTone={iap.statusTone as StatusTone}
        canSubmit={iap.canSubmit}
        canUnsubmit={iap.canUnsubmit}
        onSubmit={() => iap.submit()}
        onUnsubmit={() => iap.unsubmit()}
        submitHint={submitHint}
      />

      {iap.needsAttention && (
        <NeedsAttentionBanner
          title={iap.statusLabel}
          message="Add a localization with a display name and set a base price before submitting for review."
        />
      )}

      <ProductTabBar tabs={TABS} active={tab} onChange={(k) => setTab(k as TabKey)} />

      {tab === 'localizations' && <IAPLocalizationsTab iap={iap} />}
      {tab === 'pricing' && <IAPPricingTab iap={iap} />}
      {tab === 'availability' && <IAPAvailabilityTab iap={iap} />}
      {tab === 'review' && <IAPReviewTab iap={iap} />}
      {tab === 'offers' && <IAPOffersTab iap={iap} />}
    </div>
  );
}

export const IAPDetail = observer(IAPDetailImpl);
