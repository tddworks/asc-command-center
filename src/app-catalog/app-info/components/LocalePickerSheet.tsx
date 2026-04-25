import { useEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import type { AppInfo } from '../AppInfo.ts';
import { localeDisplayName } from '../AppStoreLocaleRegistry.ts';
import { useToast } from '../../../shared/components/Toast.tsx';

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
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const showToast = useToast();

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

  // Snapshot the staged counts BEFORE save — after save they're flushed,
  // and the toast text would otherwise read "Saved 0 …".
  const handleSave = async () => {
    const adds = appInfo.localizations.filter((l) => l.id === '').length;
    const removes = appInfo.pendingRemovals.length;
    setSaving(true);
    try {
      await appInfo.save();
      showToast(savedToast(adds, removes), 'success');
    } catch (err) {
      showToast(`Save failed: ${(err as Error).message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    appInfo.discard();
    showToast('Discarded changes', 'info');
  };

  const needle = query.trim().toLowerCase();
  const matchesActive = (locale: string) =>
    !needle ||
    `${localeDisplayName(locale)} ${locale}`.toLowerCase().includes(needle);

  // Sort: primary first, then alphabetical. Inline sort is cheap and keeps
  // the active list in sync with MobX mutations without `useMemo`.
  const activeLive = [...appInfo.localizations].sort((a, b) => {
    if (a.locale === appInfo.primaryLocale) return -1;
    if (b.locale === appInfo.primaryLocale) return 1;
    return localeDisplayName(a.locale).localeCompare(localeDisplayName(b.locale));
  });
  const pendingRemovals = [...appInfo.pendingRemovals].sort((a, b) =>
    localeDisplayName(a.locale).localeCompare(localeDisplayName(b.locale)),
  );
  const filteredLive = activeLive.filter((l) => matchesActive(l.locale));
  const filteredPending = pendingRemovals.filter((l) => matchesActive(l.locale));
  const activeCount = appInfo.localizations.length + appInfo.pendingRemovals.length;
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
              <h4>Active <span className="locale-manager-count">{activeCount}</span></h4>
            </header>
            {filteredLive.length === 0 && filteredPending.length === 0 ? (
              <div className="locale-manager-empty">{needle ? 'No active languages match.' : 'No active languages.'}</div>
            ) : (
              <ul className="locale-manager-list">
                {filteredLive.map((loc) => {
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
                {filteredPending.map((loc) => (
                  <li
                    key={`pending-${loc.locale}`}
                    className="locale-manager-row is-active is-removing"
                  >
                    <span className="locale-manager-row-text">
                      <span className="locale-manager-row-name">
                        <span className="locale-manager-row-strike">
                          {localeDisplayName(loc.locale) || loc.locale}
                        </span>
                        <span className="locale-manager-badge tone-removing">Removing</span>
                      </span>
                      <span className="locale-manager-row-code locale-manager-row-strike">{loc.locale}</span>
                    </span>
                    <button
                      type="button"
                      className="locale-manager-row-action tone-undo"
                      onClick={() => appInfo.restoreLocalization(loc.locale)}
                      aria-label={`Undo removing ${localeDisplayName(loc.locale) || loc.locale}`}
                      title="Undo remove"
                    >
                      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 10a5 5 0 1 1 1.5 3.5"/>
                        <path d="M3 6v4h4"/>
                      </svg>
                    </button>
                  </li>
                ))}
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

        <div className={`locale-manager-footer ${appInfo.hasUnsavedChanges ? 'is-pending' : ''}`}>
          <span className="locale-manager-footer-text">
            {appInfo.hasUnsavedChanges ? (
              <><span className="locale-manager-footer-dot" aria-hidden>●</span> <strong>Pending Changes</strong></>
            ) : (
              <span style={{ color: 'var(--text-muted)' }}>Add or remove languages, then Save.</span>
            )}
          </span>
          <div className="locale-manager-footer-actions">
            {appInfo.hasUnsavedChanges ? (
              <>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleDiscard}
                  disabled={saving}
                >
                  Discard
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </>
            ) : (
              <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
                Done
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

function savedToast(adds: number, removes: number): string {
  if (adds && removes) {
    return `Saved — added ${adds} ${plural(adds)}, removed ${removes} ${plural(removes)}`;
  }
  if (adds) return `Saved — added ${adds} ${plural(adds)}`;
  if (removes) return `Saved — removed ${removes} ${plural(removes)}`;
  return 'Saved changes';
}
function plural(n: number): string { return n === 1 ? 'language' : 'languages'; }
