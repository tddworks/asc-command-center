import type { Subscription } from '../Subscription.ts';
import { ReviewTab } from '../../components/ReviewTab.tsx';
import { PromotionalImagesSection } from '../../components/PromotionalImagesSection.tsx';

interface Props {
  sub: Subscription;
}

export function SubscriptionReviewTab({ sub }: Props) {
  return (
    <>
      <ReviewTab
        product={sub}
        config={{
          subjectLabel: 'subscription',
          canSaveNote: sub.canUpdate,
          notesId: 'sub-review-notes',
          notesPlaceholder: 'e.g. Use sandbox account reviewer@example.com to test this subscription.',
        }}
      />
      <PromotionalImagesSection product={sub} subjectLabel="subscription" />
    </>
  );
}
