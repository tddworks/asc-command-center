import { useEffect, useMemo, useRef, useState } from 'react';
import type { AppStoreLocale } from '../AppStoreLocaleRegistry.ts';

interface Props {
  open: boolean;
  available: readonly AppStoreLocale[];
  onAdd: (codes: string[]) => void;
  onClose: () => void;
}

/**
 * Modal sheet for picking App Store locales to add. Multi-select: rows
 * toggle in/out of a local staging set, and nothing is committed to the
 * domain until the user confirms via the footer's "Add N language(s)"
 * button. Cancel (or Escape / backdrop) discards the staging set.
 *
 * Reuses `.app-picker-*` (backdrop, modal shell, search bar, close button).
 * Selection state lives entirely inside this component — the AppInfo
 * aggregate only learns about the picks on confirm.
 */
export function LocalePickerSheet({ open, available, onAdd, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [staged, setStaged] = useState<Set<string>>(() => new Set());
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setStaged(new Set());
    requestAnimationFrame(() => inputRef.current?.focus());

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return available;
    return available.filter((l) =>
      `${l.displayName} ${l.code}`.toLowerCase().includes(needle),
    );
  }, [available, query]);

  if (!open) return null;

  const toggle = (code: string) => {
    setStaged((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const handleConfirm = () => {
    if (staged.size === 0) return;
    // Preserve the order of `available` so consumers see a stable sequence
    // rather than insertion order from clicks.
    const codes = available.filter((l) => staged.has(l.code)).map((l) => l.code);
    onAdd(codes);
    onClose();
  };

  const count = staged.size;

  return (
    <div className="app-picker-backdrop" onClick={onClose}>
      <div
        className="app-picker-modal locale-picker-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Add languages"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="app-picker-header">
          <div className="app-picker-search">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <circle cx="9" cy="9" r="6"/>
              <path d="M14 14l4 4"/>
            </svg>
            <input
              ref={inputRef}
              type="text"
              placeholder="Search languages…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <button
            type="button"
            className="app-picker-close"
            onClick={onClose}
            aria-label="Close"
          >
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M5 5l10 10M15 5L5 15"/>
            </svg>
          </button>
        </div>

        <div className="app-picker-body">
          {available.length === 0 ? (
            <div className="app-picker-empty">All App Store locales are already added.</div>
          ) : filtered.length === 0 ? (
            <div className="app-picker-empty">No languages match &ldquo;{query}&rdquo;.</div>
          ) : (
            <ul className="locale-picker-list">
              {filtered.map((l) => {
                const isSelected = staged.has(l.code);
                return (
                  <li key={l.code}>
                    <button
                      type="button"
                      className={`locale-picker-row ${isSelected ? 'is-selected' : ''}`}
                      aria-pressed={isSelected}
                      onClick={() => toggle(l.code)}
                    >
                      <span className="locale-picker-row-text">
                        <span className="locale-picker-row-name">{l.displayName}</span>
                        <span className="locale-picker-row-code">{l.code}</span>
                      </span>
                      <span
                        className={`locale-picker-row-icon ${isSelected ? 'is-checked' : ''}`}
                        aria-hidden
                      >
                        {isSelected ? (
                          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M4 10l4 4 8-8"/>
                          </svg>
                        ) : (
                          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M10 4v12M4 10h12"/>
                          </svg>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {count > 0 && (
          <div className="locale-picker-footer">
            <span className="locale-picker-footer-count">
              {count} selected
            </span>
            <div className="locale-picker-footer-actions">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setStaged(new Set())}
              >
                Clear
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleConfirm}
              >
                Add {count} {count === 1 ? 'language' : 'languages'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
