import type { ReactNode } from 'react';

export interface RadioCardOption {
  id: string;
  icon?: ReactNode;
  title: string;
  sub?: string;
  disabled?: boolean;
}

interface Props {
  name: string;
  options: RadioCardOption[];
  value: string | null;
  onChange: (id: string) => void;
  /** Tone of the selected ring — e.g. 'blue' for privacy, 'green' for release type. */
  selectedTone?: 'blue' | 'green';
}

/**
 * Full-width radio-card group. Each option is a row: (optional icon) + title +
 * sub-label, with a checkmark and colored ring on the selected row.
 * Matches the Release Type / Content Rights groups from the iOS screenshots.
 */
export function RadioCard({ name, options, value, onChange, selectedTone = 'blue' }: Props) {
  return (
    <div className={`radio-cards radio-cards-${selectedTone}`}>
      {options.map((opt) => {
        const selected = opt.id === value;
        return (
          <label
            key={opt.id}
            className={`radio-card ${selected ? 'is-selected' : ''} ${opt.disabled ? 'is-disabled' : ''}`}
          >
            <input
              type="radio"
              name={name}
              value={opt.id}
              checked={selected}
              disabled={opt.disabled}
              onChange={() => onChange(opt.id)}
            />
            <span className="radio-card-check" aria-hidden>
              {selected ? (
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="8" cy="8" r="7" fill="currentColor" stroke="none"/>
                  <polyline points="4.5 8 7 10.5 11.5 5.5" stroke="#fff"/>
                </svg>
              ) : (
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
                  <circle cx="8" cy="8" r="6.5"/>
                </svg>
              )}
            </span>
            {opt.icon && (
              <span className="radio-card-icon">{opt.icon}</span>
            )}
            <span className="radio-card-text">
              <span className="radio-card-title">{opt.title}</span>
              {opt.sub && <span className="radio-card-sub">{opt.sub}</span>}
            </span>
          </label>
        );
      })}
    </div>
  );
}
