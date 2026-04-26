import { observer } from 'mobx-react-lite';
import type { Subscription } from '../Subscription.ts';
import { AvailabilityTab } from '../../components/AvailabilityTab.tsx';

interface Props {
  sub: Subscription;
}

/**
 * Thin wrapper. The actual UI lives in `monetization/components/
 * AvailabilityTab` and is shared with the IAP slice.
 */
function SubscriptionAvailabilityTabImpl({ sub }: Props) {
  return <AvailabilityTab product={sub} config={{ productKind: 'Subscription tier' }} />;
}

export const SubscriptionAvailabilityTab = observer(SubscriptionAvailabilityTabImpl);
