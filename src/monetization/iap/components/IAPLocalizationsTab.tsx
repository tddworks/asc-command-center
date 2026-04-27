import { observer } from 'mobx-react-lite';
import type { InAppPurchase } from '../InAppPurchase.ts';
import {
  IAP_LOCALIZATION_DESCRIPTION_LIMIT,
  IAP_LOCALIZATION_NAME_LIMIT,
} from '../InAppPurchaseLocalization.ts';
import { LocalizationsTab } from '../../components/LocalizationsTab.tsx';
import { workspace } from '../../../workspace/workspaceInstance.ts';

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
        slotKinds: {
          name: 'iapLocalization.name',
          description: 'iapLocalization.description',
        },
        primaryLocale: workspace.currentApp?.primaryLocale ?? 'en-US',
      }}
    />
  );
}

export const IAPLocalizationsTab = observer(IAPLocalizationsTabImpl);
