import { observer } from 'mobx-react-lite';
import type { Subscription } from '../Subscription.ts';
import {
  SUBSCRIPTION_LOCALIZATION_DESCRIPTION_LIMIT,
  SUBSCRIPTION_LOCALIZATION_NAME_LIMIT,
} from '../SubscriptionLocalization.ts';
import { LocalizationsTab } from '../../components/LocalizationsTab.tsx';
import { workspace } from '../../../workspace/workspaceInstance.ts';

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
        slotKinds: {
          name: 'subscriptionLocalization.name',
          description: 'subscriptionLocalization.description',
        },
        primaryLocale: workspace.currentApp?.primaryLocale ?? 'en-US',
      }}
    />
  );
}

export const SubscriptionLocalizationsTab = observer(SubscriptionLocalizationsTabImpl);
