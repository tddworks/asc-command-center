import type { Subscription } from '../Subscription.ts';
import { SubscriptionPriceBucket } from '../SubscriptionPricePoint.ts';
import {
  PricePointPickerModal,
  type PricePointBucketPill,
} from '../../components/PricePointPickerModal.tsx';

interface Props {
  sub: Subscription;
  open: boolean;
  onClose: () => void;
}

const BUCKETS: PricePointBucketPill[] = [
  { value: SubscriptionPriceBucket.All, label: 'All' },
  { value: SubscriptionPriceBucket.Under1, label: '<$1' },
  { value: SubscriptionPriceBucket.From1To10, label: '$1–$10' },
  { value: SubscriptionPriceBucket.From10To50, label: '$10–$50' },
  { value: SubscriptionPriceBucket.From50To100, label: '$50–$100' },
  { value: SubscriptionPriceBucket.Over100, label: '$100+' },
];

export function SubscriptionPricePointPickerModal({ sub, open, onClose }: Props) {
  return (
    <PricePointPickerModal
      product={sub}
      open={open}
      onClose={onClose}
      config={{
        productLabel: sub.name,
        hasExistingPrice: !!sub.priceSchedule,
        initialTerritoryId: 'USA',
        territoryFieldLabel: 'Anchor Territory',
        buckets: BUCKETS,
        defaultBucket: SubscriptionPriceBucket.All,
        filter: (p, bucket, query) =>
          p.matchesBucket(bucket as SubscriptionPriceBucket) && p.matches(query),
        onConfirm: ({ territoryId, pricePointId }) => sub.setPrices([{ territoryId, pricePointId }]),
      }}
    />
  );
}
