interface Props {
  title: string;
  message: string;
}

/** Warning banner shown above the tab bar when an IAP/Subscription needs
 *  developer action (missing metadata / rejected / developer-action-needed). */
export function NeedsAttentionBanner({ title, message }: Props) {
  return (
    <div
      role="status"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        marginBottom: 12,
        padding: '12px 16px',
        background: 'var(--warning-bg)',
        border: '1px solid var(--warning-text)',
        borderRadius: 8,
        color: 'var(--warning-text)',
      }}
    >
      <span aria-hidden style={{ fontSize: 16, lineHeight: '20px' }}>⚠️</span>
      <div style={{ flex: 1, lineHeight: 1.5 }}>
        <div style={{ fontWeight: 600, marginBottom: 2 }}>{title}</div>
        <div style={{ fontSize: 13, opacity: 0.9 }}>{message}</div>
      </div>
    </div>
  );
}
