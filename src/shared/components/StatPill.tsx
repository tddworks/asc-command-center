interface Props {
  count: number;
  label: string;
  tone?: 'neutral' | 'info' | 'warning' | 'success' | 'danger';
}

const TONE_STYLES: Record<NonNullable<Props['tone']>, { bg: string; fg: string }> = {
  neutral: { bg: 'var(--bg)',           fg: 'var(--text-secondary)' },
  info:    { bg: 'var(--accent-light)', fg: 'var(--accent)' },
  warning: { bg: 'var(--warning-bg)',   fg: 'var(--warning-text)' },
  success: { bg: 'var(--success-bg)',   fg: 'var(--success-text)' },
  danger:  { bg: 'var(--danger-bg)',    fg: 'var(--danger-text)' },
};

/**
 * Compact count + label pill for header summaries (e.g. `[5 IAPs]
 * [1 In Review] [1 Needs Action]`). Replaces the dot-separated text
 * pattern with something scannable and tonally meaningful.
 */
export function StatPill({ count, label, tone = 'neutral' }: Props) {
  const { bg, fg } = TONE_STYLES[tone];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'baseline',
        gap: 4,
        padding: '3px 10px',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 500,
        background: bg,
        color: fg,
        whiteSpace: 'nowrap',
      }}
    >
      <strong style={{ fontWeight: 600 }}>{count.toLocaleString('en-US')}</strong>
      <span>{label}</span>
    </span>
  );
}
