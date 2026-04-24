import type { ReactNode } from 'react';
import { ContentFrequency } from '../AgeRatingDeclaration.ts';

/**
 * Age-rating wizard leaf components, ported from the SwiftUI design in
 * `AgeRatingBooleanRow.swift` / `AgeRatingFrequencyRow.swift`.
 *
 * Layout:
 *  • Section header — icon + title on a muted band.
 *  • Row           — title + description left-aligned, controls right-aligned,
 *                    subtle hairline divider between rows.
 *  • Boolean       — two stand-alone 48×26 capsule buttons (No / Yes).
 *  • Frequency     — a segmented capsule container with three inner pills.
 */

// ── Section wrapper ────────────────────────────────────────────────

export function SectionCard({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        boxShadow: '0 4px 8px rgba(0, 0, 0, 0.04)',
        marginBottom: 16,
        overflow: 'hidden',
      }}
    >
      {children}
    </div>
  );
}

export function BooleanSectionHeader({ title, icon }: { title: string; icon?: ReactNode }) {
  return <SectionHeader title={title} icon={icon} />;
}

export function FrequencySectionHeader({ title, icon }: { title: string; icon?: ReactNode }) {
  return <SectionHeader title={title} icon={icon} />;
}

function SectionHeader({ title, icon }: { title: string; icon?: ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '10px 16px',
        background: 'var(--bg-hover, rgba(148, 163, 184, 0.12))',
        borderBottom: '1px solid var(--border-light, var(--border))',
      }}
    >
      {icon && (
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 16,
          height: 16,
          color: 'var(--accent, #2563eb)',
        }}>
          {icon}
        </span>
      )}
      <span style={{
        fontSize: 13,
        fontWeight: 600,
        color: 'var(--text-primary)',
      }}>
        {title}
      </span>
    </div>
  );
}

// ── Row shell ──────────────────────────────────────────────────────

function Row({ title, description, children, first: _first }: {
  title: string;
  description: string;
  children: ReactNode;
  /** Legacy flag — SwiftUI design has no dividers between rows, kept in the
   *  signature so existing call-sites compile without a mass rename. */
  first?: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '14px 16px',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--text-primary)',
          marginBottom: 4,
        }}>
          {title}
        </div>
        <div style={{
          fontSize: 11.5,
          color: 'var(--text-muted)',
          lineHeight: 1.55,
        }}>
          {description}
        </div>
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  );
}

// ── Boolean row ────────────────────────────────────────────────────

interface BooleanRowProps {
  title: string;
  description: string;
  value: boolean | null;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  first?: boolean;
}

export function BooleanRow({ title, description, value, onChange, disabled, first }: BooleanRowProps) {
  return (
    <Row title={title} description={description} first={first}>
      <div style={{ display: 'inline-flex', gap: 6 }}>
        <CapsuleButton selected={value === false} disabled={disabled} onClick={() => onChange(false)}>
          NO
        </CapsuleButton>
        <CapsuleButton selected={value === true} disabled={disabled} onClick={() => onChange(true)}>
          YES
        </CapsuleButton>
      </div>
    </Row>
  );
}

function CapsuleButton({
  children, selected, disabled, onClick,
}: {
  children: ReactNode;
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        width: 58,
        height: 30,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 999,
        border: 'none',
        background: selected
          ? 'var(--accent, #2563eb)'
          : 'rgba(148, 163, 184, 0.22)',
        color: selected ? '#fff' : 'var(--text-secondary)',
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.04em',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'all 120ms',
      }}
    >
      {children}
    </button>
  );
}

// ── Frequency row ──────────────────────────────────────────────────

interface FrequencyRowProps {
  title: string;
  description: string;
  value: ContentFrequency | null;
  onChange: (v: ContentFrequency) => void;
  disabled?: boolean;
  first?: boolean;
}

const FREQUENCY_OPTIONS: Array<{ id: ContentFrequency; label: string }> = [
  { id: ContentFrequency.None,            label: 'None'       },
  { id: ContentFrequency.InfrequentMild,  label: 'Infrequent' },
  { id: ContentFrequency.FrequentIntense, label: 'Frequent'   },
];

export function FrequencyRow({ title, description, value, onChange, disabled, first }: FrequencyRowProps) {
  return (
    <Row title={title} description={description} first={first}>
      <div
        role="radiogroup"
        style={{
          display: 'inline-flex',
          gap: 2,
          padding: 3,
          borderRadius: 999,
          background: 'var(--bg, rgba(148, 163, 184, 0.22))',
        }}
      >
        {FREQUENCY_OPTIONS.map((o) => (
          <SegmentButton
            key={o.id}
            selected={value === o.id}
            disabled={disabled}
            onClick={() => onChange(o.id)}
          >
            {o.label}
          </SegmentButton>
        ))}
      </div>
    </Row>
  );
}

function SegmentButton({
  children, selected, disabled, onClick,
}: {
  children: ReactNode;
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      disabled={disabled}
      style={{
        height: 24,
        padding: '0 12px',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 999,
        border: 'none',
        background: selected ? 'var(--accent, #2563eb)' : 'transparent',
        color: selected ? '#fff' : 'var(--text-secondary)',
        fontSize: 11,
        fontWeight: 500,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'all 120ms',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  );
}
