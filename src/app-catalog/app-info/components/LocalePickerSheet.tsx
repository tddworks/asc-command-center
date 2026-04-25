import { useEffect, useMemo, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import type { AppInfo } from '../AppInfo.ts';
import { localeDisplayName } from '../AppStoreLocaleRegistry.ts';

interface Props {
  open: boolean;
  appInfo: AppInfo;
  onClose: () => void;
}

/**
 * Language Manager sheet — mirrors the macOS reference design. Shows both
 * the locales currently attached to the AppInfo (Active) and the App Store
 * locales available to add (Add Language) in one modal. Adds and removes
 * mutate the AppInfo aggregate directly; the page-level StickySaveBar
 * commits or discards the resulting dirty state.
 *
 * Wrapped in `observer()` so rows move between sections in real time as
 * the user adds/removes — without round-tripping local staging state.
 */
export const LocalePickerSheet = observer(function LocalePickerSheet({
  open, appInfo, onClose,
}: Props) {
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setSaveError(null);
    requestAnimationFrame(() => inputRef.current?.focus());

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Sort active locales: primary first, then alphabetical by display name —
  // matches the Mac mockup where en-US sits at the top of the list.
  const activeRows = useMemo(() => {
    const list = [...appInfo.localizations];
    list.sort((a, b) => {
      if (a.locale === appInfo.primaryLocale) return -1;
      if (b.locale === appInfo.primaryLocale) return 1;
      return localeDisplayName(a.locale).localeCompare(localeDisplayName(b.locale));
    });
    return list;
  }, [appInfo.localizations, appInfo.primaryLocale]);

  const needle = query.trim().toLowerCase();

  const filteredActive = useMemo(() => {
    if (!needle) return activeRows;
    return activeRows.filter((l) =>
      `${localeDisplayName(l.locale)} ${l.locale}`.toLowerCase().includes(needle),
    );
  }, [activeRows, needle]);

  const filteredAvailable = useMemo(() => {
    if (!needle) return appInfo.availableLocalesToAdd;
    return appInfo.availableLocalesToAdd.filter((l) =>
      `${l.displayName} ${l.code}`.toLowerCase().includes(needle),
    );
  }, [appInfo.availableLocalesToAdd, needle]);

  if (!open) return null;

  const handleAdd = (code: string) => {
    try {
      appInfo.addLocalization(code);
    } catch (err) {
      setSaveError((err as Error).message);
    }
  };

  const handleRemove = (locale: string) => {
    try {
      appInfo.removeLocalization(locale);
    } catch (err) {
      setSaveError((err as Error).message);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      await appInfo.save();
    } catch (err) {
      setSaveError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    appInfo.discard();
    setSaveError(null);
  };

  const dirty = appInfo.hasUnsavedChanges;

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
          <div>
            <h3 className="locale-manager-title">Language Manager</h3>
            <p className="locale-manager-subtitle">Manage your App Store locales</p>
          </div>
          <div className="locale-manager-titlebar-right">
            {dirty && <span className="locale-manager-modified">● Modified</span>}
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
          <Section
            title="Active Languages"
            countLabel={`${activeRows.length} ${activeRows.length === 1 ? 'language' : 'languages'}`}
            countTone="active"
          >
            {filteredActive.length === 0 ? (
              <EmptyHint>{needle ? 'No active languages match.' : 'No active languages.'}</EmptyHint>
            ) : (
              <div className="locale-manager-grid">
                {filteredActive.map((loc) => {
                  const isPrimary = loc.locale === appInfo.primaryLocale;
                  const isNew = loc.id === '';
                  return (
                    <div
                      key={loc.locale}
                      className={`locale-manager-card is-active ${isPrimary ? 'is-primary' : ''} ${isNew ? 'is-new' : ''}`}
                    >
                      <span className="locale-manager-card-icon" aria-hidden>
                        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="10" cy="10" r="7"/>
                          <path d="M3 10h14M10 3a14 14 0 0 1 0 14M10 3a14 14 0 0 0 0 14"/>
                        </svg>
                      </span>
                      <span className="locale-manager-card-text">
                        <span className="locale-manager-card-row1">
                          <span className="locale-manager-card-name">
                            {localeDisplayName(loc.locale) || loc.locale}
                          </span>
                          {isPrimary && <span className="locale-manager-badge tone-primary">Primary</span>}
                          {isNew && !isPrimary && <span className="locale-manager-badge tone-new">New</span>}
                        </span>
                        <span className="locale-manager-card-code">{loc.locale}</span>
                        <span className="locale-manager-card-status tone-ok">● Active</span>
                      </span>
                      {!isPrimary && (
                        <button
                          type="button"
                          className="locale-manager-card-action tone-remove"
                          onClick={() => handleRemove(loc.locale)}
                          aria-label={`Remove ${localeDisplayName(loc.locale) || loc.locale}`}
                        >
                          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M5 10h10"/>
                          </svg>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Section>

          <Section
            title="Add Language"
            countLabel={`${appInfo.availableLocalesToAdd.length} ${appInfo.availableLocalesToAdd.length === 1 ? 'language' : 'languages'}`}
            countTone="available"
          >
            {appInfo.availableLocalesToAdd.length === 0 ? (
              <EmptyHint>All App Store locales are already added.</EmptyHint>
            ) : filteredAvailable.length === 0 ? (
              <EmptyHint>No languages match &ldquo;{query}&rdquo;.</EmptyHint>
            ) : (
              <div className="locale-manager-grid">
                {filteredAvailable.map((l) => (
                  <button
                    key={l.code}
                    type="button"
                    className="locale-manager-card is-available"
                    onClick={() => handleAdd(l.code)}
                  >
                    <span className="locale-manager-card-action tone-add" aria-hidden>
                      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M10 5v10M5 10h10"/>
                      </svg>
                    </span>
                    <span className="locale-manager-card-text">
                      <span className="locale-manager-card-row1">
                        <span className="locale-manager-card-name">{l.displayName}</span>
                      </span>
                      <span className="locale-manager-card-code">{l.code}</span>
                      <span className="locale-manager-card-status tone-muted">● Available</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </Section>
        </div>

        {(dirty || saveError) && (
          <div className="locale-manager-footer">
            <span className="locale-manager-footer-text">
              {saveError
                ? <span className="save-bar-error">Save failed: {saveError}</span>
                : <><strong>Pending Changes</strong> · localizations</>}
            </span>
            <div className="locale-manager-footer-actions">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleDiscard}
                disabled={saving || !dirty}
              >
                Discard
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleSave}
                disabled={saving || !dirty}
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

function Section({
  title, countLabel, countTone, children,
}: {
  title: string;
  countLabel: string;
  countTone: 'active' | 'available';
  children: React.ReactNode;
}) {
  return (
    <section className="locale-manager-section">
      <header className="locale-manager-section-header">
        <h4 className="locale-manager-section-title">{title}</h4>
        <span className={`locale-manager-section-count tone-${countTone}`}>{countLabel}</span>
      </header>
      {children}
    </section>
  );
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return <div className="locale-manager-empty">{children}</div>;
}
