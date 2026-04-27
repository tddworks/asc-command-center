import type { InAppPurchase } from '../InAppPurchase.ts';
import { PriceBucket } from '../IAPPricePoint.ts';
import {
  PricePointPickerModal,
  type PricePointBucketPill,
} from '../../components/PricePointPickerModal.tsx';

interface Props {
  iap: InAppPurchase;
  open: boolean;
  onClose: () => void;
}

const BUCKETS: PricePointBucketPill[] = [
  { value: PriceBucket.All, label: 'All' },
  { value: PriceBucket.Under1, label: '<$1' },
  { value: PriceBucket.From1To10, label: '$1–$10' },
  { value: PriceBucket.From10To50, label: '$10–$50' },
  { value: PriceBucket.From50To100, label: '$50–$100' },
  { value: PriceBucket.Over100, label: '$100+' },
];

export function IAPPricePointPickerModal({ iap, open, onClose }: Props) {
  const existing = iap.priceSchedule;
  return (
    <PricePointPickerModal
      product={iap}
      open={open}
      onClose={onClose}
      config={{
        productLabel: iap.referenceName,
        hasExistingPrice: !!existing,
        initialTerritoryId: existing?.baseTerritoryId ?? 'USA',
        territoryFieldLabel: 'Base Territory',
        buckets: BUCKETS,
        defaultBucket: PriceBucket.All,
        filter: (p, bucket, query) => p.matchesBucket(bucket as PriceBucket) && p.matches(query),
        onConfirm: ({ territoryId, pricePointId }) => iap.setPrice({ territoryId, pricePointId }),
      }}
    />
  );
}
