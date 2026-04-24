import { observer } from 'mobx-react-lite';
import type { AgeRatingDeclaration } from '../../AgeRatingDeclaration.ts';
import {
  BooleanRow,
  BooleanSectionHeader,
  SectionCard,
} from '../AgeRatingRows.tsx';
import { GearIcon, GlobeIcon } from '../AgeRatingIcons.tsx';

/**
 * Step 1 — In-app controls and capabilities. Two sections of boolean flags
 * answering "does your app include this feature".
 */
export const FeaturesStep = observer(function FeaturesStep({
  declaration,
}: { declaration: AgeRatingDeclaration }) {
  return (
    <>
      <SectionCard>
        <BooleanSectionHeader title="In-App Controls" icon={<GearIcon />} />
        <BooleanRow
          first
          title="Parental Controls"
          description="The app lets parents restrict access to features or content."
          value={declaration.isParentalControls}
          onChange={(v) => declaration.isParentalControls = v}
        />
        <BooleanRow
          title="Age Assurance"
          description="The app verifies the user's age before granting access."
          value={declaration.isAgeAssurance}
          onChange={(v) => declaration.isAgeAssurance = v}
        />
      </SectionCard>

      <SectionCard>
        <BooleanSectionHeader title="Capabilities" icon={<GlobeIcon />} />
        <BooleanRow
          first
          title="Unrestricted Web Access"
          description="The app opens the public web without content filters."
          value={declaration.isUnrestrictedWebAccess}
          onChange={(v) => declaration.isUnrestrictedWebAccess = v}
        />
        <BooleanRow
          title="User-Generated Content"
          description="Users contribute text, images, video, or audio."
          value={declaration.isUserGeneratedContent}
          onChange={(v) => declaration.isUserGeneratedContent = v}
        />
        <BooleanRow
          title="Messaging & Chat"
          description="The app enables direct communication between users."
          value={declaration.isMessagingAndChat}
          onChange={(v) => declaration.isMessagingAndChat = v}
        />
        <BooleanRow
          title="Advertising"
          description="The app shows ads (including in-house promotions)."
          value={declaration.isAdvertising}
          onChange={(v) => declaration.isAdvertising = v}
        />
      </SectionCard>
    </>
  );
});
