import { ContentFrequency } from '../AgeRatingDeclaration.ts';

/**
 * Shared leaf components for the age-rating wizard. Each row poses one
 * question to the user and lets them pick a value; the `null` state means
 * "not yet answered" so the UI stays honest about what has and hasn't been
 * reviewed.
 *
 * Visually compact: tri-state pills for yes/no and a three-way pill set
 * (None / Infrequent / Frequent) for the mature-content scale. Matches
 * Apple's App Store Connect flow without trying to copy its exact chrome.
 */

interface BooleanRowProps {
  title: string;
  description: string;
  value: boolean | null;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}

export function BooleanRow({ title, description, value, onChange, disabled }: BooleanRowProps) {
  return (
    <div className="ar-row">
      <div className="ar-row-text">
        <div className="ar-row-title">{title}</div>
        <div className="ar-row-desc">{description}</div>
      </div>
      <div className="ar-row-controls">
        <PillButton selected={value === false} disabled={disabled} onClick={() => onChange(false)} tone="neutral">No</PillButton>
        <PillButton selected={value === true}  disabled={disabled} onClick={() => onChange(true)}  tone="accent">Yes</PillButton>
      </div>
    </div>
  );
}

interface FrequencyRowProps {
  title: string;
  description: string;
  value: ContentFrequency | null;
  onChange: (v: ContentFrequency) => void;
  disabled?: boolean;
}

export function FrequencyRow({ title, description, value, onChange, disabled }: FrequencyRowProps) {
  const options: Array<{ id: ContentFrequency; label: string; tone: Tone }> = [
    { id: ContentFrequency.None,            label: 'None',       tone: 'neutral' },
    { id: ContentFrequency.InfrequentMild,  label: 'Infrequent', tone: 'amber'   },
    { id: ContentFrequency.FrequentIntense, label: 'Frequent',   tone: 'red'     },
  ];
  return (
    <div className="ar-row">
      <div className="ar-row-text">
        <div className="ar-row-title">{title}</div>
        <div className="ar-row-desc">{description}</div>
      </div>
      <div className="ar-row-controls">
        {options.map((o) => (
          <PillButton
            key={o.id}
            selected={value === o.id}
            disabled={disabled}
            onClick={() => onChange(o.id)}
            tone={o.tone}
          >
            {o.label}
          </PillButton>
        ))}
      </div>
    </div>
  );
}

type Tone = 'neutral' | 'accent' | 'amber' | 'red';

function PillButton({
  children, selected, disabled, onClick, tone,
}: {
  children: React.ReactNode;
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
  tone: Tone;
}) {
  const bg = selected
    ? (tone === 'accent' ? 'var(--accent, #2563eb)'
      : tone === 'amber' ? '#f59e0b'
      : tone === 'red'   ? '#dc2626'
      : 'var(--text-secondary)')
    : 'transparent';
  const color = selected ? '#fff' : 'var(--text-secondary)';
  const border = selected ? bg : 'var(--border)';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '6px 14px',
        fontSize: 12,
        fontWeight: 600,
        borderRadius: 999,
        background: bg,
        color,
        border: `1px solid ${border}`,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'all 120ms',
      }}
    >
      {children}
    </button>
  );
}

export function SectionCard({
  title, children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="toolbar"><div className="toolbar-left"><h3 style={{ fontSize: 14 }}>{title}</h3></div></div>
      <div style={{ padding: '4px 0' }}>{children}</div>
    </div>
  );
}
