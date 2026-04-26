import { useEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import type { InAppPurchase } from '../InAppPurchase.ts';
import {
  APP_STORE_LOCALES,
  localeDisplayName,
} from '../../../shared/AppStoreLocaleRegistry.ts';

interface Props {
  open: boolean;
  iap: InAppPurchase;
  onClose: () => void;
}

/**
 * Language Manager sheet for an IAP. Mirrors AppInfo's LocalePickerSheet
 * — a single modal with two sections (Active / Add). Each click commits
 * directly: there's no batched save here because IAP localizations save
 * per-row from the table.
 */
export const IAPLocalePickerSheet = observer(function IAPLocalePickerSheet({
  open, iap, onClose,
}: Props) {
  const [query, setQuery] = useState('');
  const [pendingLocale, setPendingLocale] = useState<string | null>(null);
  const [pendingName, setPendingName] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setPendingLocale(null);
    setPendingName('');
    requestAnimationFrame(() => inputRef.current?.focus());
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const taken = new Set(iap.localizations.map((l) => l.locale));
  const available = APP_STORE_LOCALES.filter((l) => !taken.has(l.code));
  const needle = query.trim().toLowerCase();
  const matches = (display: string, code: string) =>
    !needle || `${display} ${code}`.toLowerCase().includes(needle);

  const filteredActive = [...iap.localizations].filter((l) =>
    matches(localeDisplayName(l.locale), l.locale),
  );
  const filteredAvailable = available.filter((l) => matches(l.displayName, l.code));

  const startAdd = (code: string) => {
    setPendingLocale(code);
    setPendingName('');
  };

  const commitAdd = async () => {
    if (!pendingLocale) return;
    const trimmed = pendingName.trim();
    if (!trimmed) return;
    try {
      await iap.addLocalization({ locale: pendingLocale, name: trimmed });
      setPendingLocale(null);
      setPendingName('');
    } catch (err) {
      console.warn('[iap] addLocalization failed:', err);
    }
  };

  const remove = async (locale: string) => {
    const loc = iap.localizations.find((l) => l.locale === locale);
    if (!loc) return;
    if (!loc.canDelete) return;
    if (!confirm(`Remove ${localeDisplayName(locale) || locale}?`)) return;
    try { await iap.removeLocalization(loc); }
    catch (err) { console.warn('[iap] removeLocalization failed:', err); }
  };

  return (
    <div className="app-picker-backdrop" onClick={onClose}>
      <div
        className="app-picker-modal locale-manager-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Language manager"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="locale-manager-titlebar">
          <h3 className="locale-manager-title">Languages · {iap.referenceName}</h3>
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

        <div className="locale-manager-search">
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

        <div className="locale-manager-body">
          <section className="locale-manager-section">
            <header className="locale-manager-section-header">
              <h4>Active <span className="locale-manager-count">{iap.localizations.length}</span></h4>
            </header>
            {filteredActive.length === 0 ? (
              <div className="locale-manager-empty">{needle ? 'No active languages match.' : 'No active languages.'}</div>
            ) : (
              <ul className="locale-manager-list">
                {filteredActive.map((loc, idx) => {
                  const isPrimary = idx === 0;
                  return (
                    <li
                      key={loc.locale}
                      className={`locale-manager-row is-active ${isPrimary ? 'is-primary' : ''}`}
                    >
                      <span className="locale-manager-row-text">
                        <span className="locale-manager-row-name">
                          {localeDisplayName(loc.locale) || loc.locale}
                          {isPrimary && <span className="locale-manager-badge tone-primary">Source</span>}
                        </span>
                        <span className="locale-manager-row-code">{loc.locale}</span>
                      </span>
                      {!isPrimary && loc.canDelete && (
                        <button
                          type="button"
                          className="locale-manager-row-action tone-remove"
                          onClick={() => remove(loc.locale)}
                          aria-label={`Remove ${localeDisplayName(loc.locale) || loc.locale}`}
                          title="Remove"
                        >
                          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M5 10h10"/>
                          </svg>
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="locale-manager-section">
            <header className="locale-manager-section-header">
              <h4>Add <span className="locale-manager-count">{available.length}</span></h4>
            </header>
            {available.length === 0 ? (
              <div className="locale-manager-empty">All App Store locales are already added.</div>
            ) : filteredAvailable.length === 0 ? (
              <div className="locale-manager-empty">No languages match &ldquo;{query}&rdquo;.</div>
            ) : (
              <ul className="locale-manager-list">
                {filteredAvailable.map((l) => (
                  <li key={l.code} className="locale-manager-row is-available">
                    {pendingLocale === l.code ? (
                      <div style={{ display: 'flex', gap: 6, width: '100%', alignItems: 'center' }}>
                        <span className="locale-manager-row-text" style={{ flex: '0 0 auto' }}>
                          <span className="locale-manager-row-name">{l.displayName}</span>
                          <span className="locale-manager-row-code">{l.code}</span>
                        </span>
                        <input
                          autoFocus
                          className="form-input"
                          style={{ flex: 1 }}
                          placeholder="Display name (e.g. Premium)"
                          value={pendingName}
                          maxLength={30}
                          onChange={(e) => setPendingName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') void commitAdd();
                            if (e.key === 'Escape') setPendingLocale(null);
                          }}
                        />
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => void commitAdd()}
                          disabled={!pendingName.trim()}
                        >
                          Add
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => setPendingLocale(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="locale-manager-row-button"
                        onClick={() => startAdd(l.code)}
                        disabled={!iap.canCreateLocalization}
                      >
                        <span className="locale-manager-row-text">
                          <span className="locale-manager-row-name">{l.displayName}</span>
                          <span className="locale-manager-row-code">{l.code}</span>
                        </span>
                        <span className="locale-manager-row-action tone-add" aria-hidden>
                          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M10 5v10M5 10h10"/>
                          </svg>
                        </span>
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="locale-manager-footer">
          <span className="locale-manager-footer-text" style={{ color: 'var(--text-muted)' }}>
            Add or remove languages, then close.
          </span>
          <div className="locale-manager-footer-actions">
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});
