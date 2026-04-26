import { observer } from 'mobx-react-lite';
import type { InAppPurchase } from '../InAppPurchase.ts';
import {
  IAP_LOCALIZATION_DESCRIPTION_LIMIT,
  IAP_LOCALIZATION_NAME_LIMIT,
} from '../InAppPurchaseLocalization.ts';
import { LocalizationsTab } from '../../components/LocalizationsTab.tsx';

interface Props {
  iap: InAppPurchase;
}

/**
 * Thin wrapper. The actual UI lives in `monetization/components/
 * LocalizationsTab` and is shared with the Subscription tier.
 */
function IAPLocalizationsTabImpl({ iap }: Props) {
  return (
    <LocalizationsTab
      product={iap}
      config={{
        productLabel: iap.referenceName,
        nameLimit: IAP_LOCALIZATION_NAME_LIMIT,
        descriptionLimit: IAP_LOCALIZATION_DESCRIPTION_LIMIT,
        aiContext: {
          name: 'In-app purchase display name',
          description: 'In-app purchase description',
        },
      }}
    />
  );
}

export const IAPLocalizationsTab = observer(IAPLocalizationsTabImpl);
