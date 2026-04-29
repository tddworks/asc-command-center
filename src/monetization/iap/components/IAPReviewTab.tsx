import type { InAppPurchase } from '../InAppPurchase.ts';
import { ReviewTab } from '../../components/ReviewTab.tsx';
import { PromotionalImagesSection } from '../../components/PromotionalImagesSection.tsx';

interface Props {
  iap: InAppPurchase;
}

export function IAPReviewTab({ iap }: Props) {
  return (
    <>
      <ReviewTab
        product={iap}
        config={{
          subjectLabel: 'IAP',
          canSaveNote: 'update' in iap.affordances,
          notesId: 'iap-review-notes',
          notesPlaceholder: 'e.g. Use sandbox account reviewer@example.com to test this IAP.',
        }}
      />
      <PromotionalImagesSection product={iap} subjectLabel="IAP" />
    </>
  );
}
