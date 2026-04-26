import { observer } from 'mobx-react-lite';
import type { InAppPurchase } from '../InAppPurchase.ts';
import { AvailabilityTab } from '../../components/AvailabilityTab.tsx';

interface Props {
  iap: InAppPurchase;
}

/**
 * Thin wrapper. The actual UI lives in `monetization/components/
 * AvailabilityTab` and is shared with the Subscription tier.
 */
function IAPAvailabilityTabImpl({ iap }: Props) {
  return <AvailabilityTab product={iap} config={{ productKind: 'In-app purchase' }} />;
}

export const IAPAvailabilityTab = observer(IAPAvailabilityTabImpl);
