import { observer } from 'mobx-react-lite';
import type { Subscription } from '../Subscription.ts';
import {
  SUBSCRIPTION_LOCALIZATION_DESCRIPTION_LIMIT,
  SUBSCRIPTION_LOCALIZATION_NAME_LIMIT,
} from '../SubscriptionLocalization.ts';
import { LocalizationsTab } from '../../components/LocalizationsTab.tsx';

interface Props {
  sub: Subscription;
}

/**
 * Thin wrapper. The actual UI lives in `monetization/components/
 * LocalizationsTab` and is shared with the IAP slice.
 */
function SubscriptionLocalizationsTabImpl({ sub }: Props) {
  return (
    <LocalizationsTab
      product={sub}
      config={{
        productLabel: sub.name,
        nameLimit: SUBSCRIPTION_LOCALIZATION_NAME_LIMIT,
        descriptionLimit: SUBSCRIPTION_LOCALIZATION_DESCRIPTION_LIMIT,
        aiContext: {
          name: 'Subscription tier display name',
          description: 'Subscription tier description',
        },
      }}
    />
  );
}

export const SubscriptionLocalizationsTab = observer(SubscriptionLocalizationsTabImpl);
