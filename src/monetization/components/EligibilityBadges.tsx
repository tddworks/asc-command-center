interface Props {
  labels: readonly string[];
}

/** Shared eligibility-badge cell renderer used by IAP and Subscription
 *  offer-code rows. Falls back to "—" when the array is empty. */
export function EligibilityBadges({ labels }: Props) {
  if (labels.length === 0) return <span className="muted">—</span>;
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {labels.map((l) => (
        <span key={l} className="platform-badge">{l}</span>
      ))}
    </div>
  );
}
