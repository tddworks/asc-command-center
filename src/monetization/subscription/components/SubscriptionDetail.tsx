import { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import type { Subscription } from '../Subscription.ts';
import { subscriptionGroups } from '../subscriptionGroupsInstance.ts';
import { SubscriptionAvailabilityTab } from './SubscriptionAvailabilityTab.tsx';
import { SubscriptionLocalizationsTab } from './SubscriptionLocalizationsTab.tsx';
import { SubscriptionOffersTab } from './SubscriptionOffersTab.tsx';
import { SubscriptionPricingTab } from './SubscriptionPricingTab.tsx';
import { SubscriptionReviewTab } from './SubscriptionReviewTab.tsx';
import { ProductDetailHeader, type StatusTone } from '../../components/ProductDetailHeader.tsx';
import { ProductTabBar } from '../../components/ProductTabBar.tsx';
import { NeedsAttentionBanner } from '../../components/NeedsAttentionBanner.tsx';

type TabKey = 'localizations' | 'pricing' | 'availability' | 'review' | 'offers';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'localizations', label: 'Localizations' },
  { key: 'availability', label: 'Availability' },
  { key: 'pricing', label: 'Pricing' },
  { key: 'review', label: 'Review' },
  { key: 'offers', label: 'Offers' },
];

interface Props {
  sub: Subscription;
}

function SubscriptionDetailImpl({ sub }: Props) {
  const [tab, setTab] = useState<TabKey>('localizations');

  useEffect(() => {
    if (sub.isLocalizationsLoaded) return;
    void sub.loadLocalizations().catch((err) => {
      console.warn('[subscription] loadLocalizations failed:', err);
    });
  }, [sub]);

  const submitHint =
    sub.canSubmit && !sub.hasAnyCompleteLocalization
      ? 'Add at least one localization with a display name before submitting for review.'
      : null;

  return (
    <div>
      <ProductDetailHeader
        backLabel="Back to subscriptions"
        onBack={() => subscriptionGroups.clearSelection()}
        name={sub.name}
        canEditName={sub.canUpdate}
        onRenameSave={(next) => sub.update({ name: next })}
        renamePlaceholder="Display name"
        productId={sub.productId}
        badges={
          <>
            <span className="platform-badge">{sub.periodLabel}</span>
            {sub.isFamilySharable && <span className="platform-badge">Family</span>}
          </>
        }
        statusLabel={sub.statusLabel}
        statusTone={sub.statusTone as StatusTone}
        canSubmit={sub.canSubmit}
        canUnsubmit={sub.canUnsubmit}
        onSubmit={() => sub.submit()}
        onUnsubmit={() => sub.unsubmit()}
        submitHint={submitHint}
      />

      {sub.needsAttention && (
        <NeedsAttentionBanner
          title={sub.statusLabel}
          message="Add a localization with a display name and set a price before submitting for review."
        />
      )}

      <ProductTabBar tabs={TABS} active={tab} onChange={(k) => setTab(k as TabKey)} />

      {tab === 'localizations' && <SubscriptionLocalizationsTab sub={sub} />}
      {tab === 'pricing' && <SubscriptionPricingTab sub={sub} />}
      {tab === 'availability' && <SubscriptionAvailabilityTab sub={sub} />}
      {tab === 'review' && <SubscriptionReviewTab sub={sub} />}
      {tab === 'offers' && <SubscriptionOffersTab sub={sub} />}
    </div>
  );
}

export const SubscriptionDetail = observer(SubscriptionDetailImpl);
