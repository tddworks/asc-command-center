import { useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import type { SubscriptionGroup } from '../SubscriptionGroup.ts';
import {
  SUBSCRIPTION_GROUP_CUSTOM_APP_NAME_LIMIT,
  SUBSCRIPTION_GROUP_NAME_LIMIT,
} from '../SubscriptionGroupLocalization.ts';
import { LocalizationsTab } from '../../components/LocalizationsTab.tsx';
import { workspace } from '../../../workspace/workspaceInstance.ts';

interface Props {
  group: SubscriptionGroup;
  bare?: boolean;
}

/**
 * Thin wrapper. Reuses the shared `LocalizationsTab` (the IAP/tier UI) and
 * relabels the second field as "Custom App Name" — App Store calls the
 * group-localization second field `customAppName` (the override shown in
 * the device's subscription management UI).
 */
function GroupLocalizationsTabImpl({ group, bare }: Props) {
  useEffect(() => {
    if (group.isGroupLocalizationsLoaded) return;
    void group.loadLocalizations().catch((err) => {
      console.warn('[group] loadLocalizations failed:', err);
    });
  }, [group]);

  return (
    <LocalizationsTab
      product={group}
      bare={bare}
      config={{
        productLabel: group.referenceName,
        nameLimit: SUBSCRIPTION_GROUP_NAME_LIMIT,
        descriptionLimit: SUBSCRIPTION_GROUP_CUSTOM_APP_NAME_LIMIT,
        // Reuse the tier-localization slot kinds so the AI plugin (which
        // matches `subscriptionLocalization.name` / `.description`) lights
        // up "AI Translate All" + per-row AI buttons here. Group + tier
        // localizations are interchangeable for the AI translate prompt:
        // both are short, user-visible localized strings.
        slotKinds: {
          name: 'subscriptionLocalization.name',
          description: 'subscriptionLocalization.description',
        },
        primaryLocale: workspace.currentApp?.primaryLocale ?? 'en-US',
        descriptionFieldLabel: 'Custom App Name',
        descriptionPlaceholder: 'Override the bundle name in the device subscription UI',
      }}
    />
  );
}

export const GroupLocalizationsTab = observer(GroupLocalizationsTabImpl);
