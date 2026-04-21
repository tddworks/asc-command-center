import { useEffect, useRef, useState } from 'react';
import type { App } from '../../app-catalog/app/App.ts';
import { AppIcon } from './AppIcon.tsx';

interface Props {
  open: boolean;
  apps: readonly App[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onClose: () => void;
}

/**
 * Full-screen modal app picker — mirrors the SwiftUI app-selector sheet.
 * Dimmed backdrop, search pill at top, responsive icon grid, click-outside
 * and Escape close.
 */
export function AppPickerModal({ open, apps, selectedId, onSelect, onClose }: Props) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    requestAnimationFrame(() => inputRef.current?.focus());

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const needle = query.trim().toLowerCase();
  const filtered = needle
    ? apps.filter((a) =>
        `${a.name} ${a.bundleId}`.toLowerCase().includes(needle),
      )
    : apps;

  return (
    <div className="app-picker-backdrop" onClick={onClose}>
      <div
        className="app-picker-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Select an app"
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
              placeholder="Search apps…"
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
          {filtered.length === 0 ? (
            <div className="app-picker-empty">
              {needle ? `No apps match “${query}”.` : 'No apps available.'}
            </div>
          ) : (
            <div className="app-picker-grid">
              {filtered.map((app) => {
                const isSelected = app.id === selectedId;
                const tone = app.statusTone;
                return (
                  <button
                    key={app.id}
                    type="button"
                    className={`app-picker-tile ${isSelected ? 'is-selected' : ''}`}
                    onClick={() => { onSelect(app.id); onClose(); }}
                  >
                    <div className="app-picker-tile-icon">
                      <AppIcon app={app} size={64} />
                      {tone !== 'neutral' && (
                        <span
                          className={`app-picker-tile-dot status-dot-${tone}`}
                          aria-hidden
                        />
                      )}
                    </div>
                    <span className="app-picker-tile-name">{app.name}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
