import { useEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import type { AppInfo } from '../AppInfo.ts';
import { localeDisplayName } from '../AppStoreLocaleRegistry.ts';

interface Props {
  open: boolean;
  appInfo: AppInfo;
  onClose: () => void;
}

/**
 * Language Manager sheet — shows the locales currently on the AppInfo
 * (Active) and the App Store locales available to add (Available) in one
 * modal. Clicking `+` or `−` mutates the AppInfo aggregate directly; both
 * are page-level staged mutations the existing StickySaveBar persists.
 *
 * Wrapped in `observer()` so add/remove animates between sections in real
 * time. Lists are computed inline (not `useMemo`) because MobX observable
 * arrays keep a stable reference across pushes — `useMemo` would never see
 * the dep change and the Active section would go stale.
 */
export const LocalePickerSheet = observer(function LocalePickerSheet({
  open, appInfo, onClose,
}: Props) {
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
  const matchesActive = (locale: string) =>
    !needle ||
    `${localeDisplayName(locale)} ${locale}`.toLowerCase().includes(needle);

  // Sort: primary first, then alphabetical. Inline sort is cheap and keeps
  // the active list in sync with MobX mutations without `useMemo`.
  const activeSorted = [...appInfo.localizations].sort((a, b) => {
    if (a.locale === appInfo.primaryLocale) return -1;
    if (b.locale === appInfo.primaryLocale) return 1;
    return localeDisplayName(a.locale).localeCompare(localeDisplayName(b.locale));
  });
  const filteredActive = activeSorted.filter((l) => matchesActive(l.locale));
  const filteredAvailable = needle
    ? appInfo.availableLocalesToAdd.filter((l) =>
        `${l.displayName} ${l.code}`.toLowerCase().includes(needle),
      )
    : appInfo.availableLocalesToAdd;

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
          <h3 className="locale-manager-title">Languages</h3>
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
              <h4>Active <span className="locale-manager-count">{appInfo.localizations.length}</span></h4>
            </header>
            {filteredActive.length === 0 ? (
              <div className="locale-manager-empty">{needle ? 'No active languages match.' : 'No active languages.'}</div>
            ) : (
              <ul className="locale-manager-list">
                {filteredActive.map((loc) => {
                  const isPrimary = loc.locale === appInfo.primaryLocale;
                  const isNew = loc.id === '';
                  return (
                    <li
                      key={loc.locale}
                      className={`locale-manager-row is-active ${isNew ? 'is-new' : ''} ${isPrimary ? 'is-primary' : ''}`}
                    >
                      <span className="locale-manager-row-text">
                        <span className="locale-manager-row-name">
                          {localeDisplayName(loc.locale) || loc.locale}
                          {isPrimary && <span className="locale-manager-badge tone-primary">Primary</span>}
                          {isNew && !isPrimary && <span className="locale-manager-badge tone-new">New</span>}
                        </span>
                        <span className="locale-manager-row-code">{loc.locale}</span>
                      </span>
                      {!isPrimary && (
                        <button
                          type="button"
                          className="locale-manager-row-action tone-remove"
                          onClick={() => appInfo.removeLocalization(loc.locale)}
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
              <h4>Add <span className="locale-manager-count">{appInfo.availableLocalesToAdd.length}</span></h4>
            </header>
            {appInfo.availableLocalesToAdd.length === 0 ? (
              <div className="locale-manager-empty">All App Store locales are already added.</div>
            ) : filteredAvailable.length === 0 ? (
              <div className="locale-manager-empty">No languages match &ldquo;{query}&rdquo;.</div>
            ) : (
              <ul className="locale-manager-list">
                {filteredAvailable.map((l) => (
                  <li key={l.code} className="locale-manager-row is-available">
                    <button
                      type="button"
                      className="locale-manager-row-button"
                      onClick={() => appInfo.addLocalization(l.code)}
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
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="locale-manager-footer">
          <span className="locale-manager-footer-text">
            {appInfo.hasUnsavedChanges
              ? <>You have <strong>unsaved changes</strong> — close this sheet and use Save changes to commit.</>
              : <>Add or remove languages — changes save with the rest of the page.</>}
          </span>
          <button type="button" className="btn btn-primary btn-sm" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
});
