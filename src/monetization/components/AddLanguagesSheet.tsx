import { useEffect, useMemo, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import type {
  LocalizationLike,
  LocalizationsConfig,
  ProductWithLocalizations,
} from './LocalizableProduct.ts';
import {
  APP_STORE_LOCALES,
  localeDisplayName,
} from '../../shared/AppStoreLocaleRegistry.ts';
import { PluginSlot } from '../../extensibility/plugin/PluginSlot.tsx';
import { workspace } from '../../workspace/workspaceInstance.ts';

interface Props<L extends LocalizationLike, P extends ProductWithLocalizations<L>> {
  open: boolean;
  product: P;
  config: LocalizationsConfig;
  onClose: () => void;
}

type Step = 'select' | 'content';

interface PendingLocaleContent {
  locale: string;
  name: string;
  description: string;
  status: 'idle' | 'saving' | 'saved' | 'error';
  error?: string | null;
}

/**
 * Two-step Add Languages sheet shared between IAP and Subscription tier
 * localizations. Mirrors the iOS `iOSMultiLanguageLocalizationSheet`:
 *
 *   Step 1 — multi-select locales (already-added shown but disabled).
 *   Step 2 — fill content for each picked locale. AI translate ships via
 *            the `text.edit` plugin slot rendered next to each input — the
 *            sheet owns no AI orchestration of its own; if no AI plugin is
 *            installed the slot renders nothing.
 *
 * Removal happens from the parent table (Edit → Remove on each row), not
 * from this sheet — keeps the add flow focused.
 */
function AddLanguagesSheetImpl<L extends LocalizationLike, P extends ProductWithLocalizations<L>>({
  open, product, config, onClose,
}: Props<L, P>) {
  const [step, setStep] = useState<Step>('select');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [contents, setContents] = useState<PendingLocaleContent[]>([]);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const source = product.localizations[0] ?? null;
  const primaryLocale = config.primaryLocale;
  /** True when the user is bootstrapping localizations from zero and the
   *  primary locale isn't saved yet. In that case the sheet auto-selects
   *  the primary and locks its checkbox so the user can't ship without
   *  it — primary is required by the App Store. */
  const primaryNotYetSaved =
    !product.localizations.some((l) => l.locale === primaryLocale);

  // Reset only on `open` transition. We deliberately exclude
  // `primaryNotYetSaved` and `onClose` from deps: after a save the
  // localization list grows and that flag flips, which would otherwise
  // re-run this effect and bounce the user back to step 'select' while
  // the modal is still open. The fresh value is read inline.
  useEffect(() => {
    if (!open) return;
    setStep('select');
    setQuery('');
    const primaryAlreadySaved = product.localizations.some((l) => l.locale === primaryLocale);
    setSelected(primaryAlreadySaved ? new Set() : new Set([primaryLocale]));
    setContents([]);
    setSaving(false);
    requestAnimationFrame(() => inputRef.current?.focus());
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const taken = useMemo(
    () => new Set(product.localizations.map((l) => l.locale)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [open, product.localizations.length],
  );

  if (!open) return null;

  const needle = query.trim().toLowerCase();
  const filtered = APP_STORE_LOCALES.filter((l) =>
    !needle || `${l.displayName} ${l.code}`.toLowerCase().includes(needle),
  );

  const isPrimaryLocked = (code: string): boolean =>
    primaryNotYetSaved && code === primaryLocale;

  const toggle = (code: string) => {
    if (taken.has(code) || isPrimaryLocked(code)) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const goNext = () => {
    if (selected.size === 0) return;
    // Render primary first (matches iOS layout where SOURCE leads).
    const ordered = [...selected].sort((a, b) => {
      if (a === primaryLocale) return -1;
      if (b === primaryLocale) return 1;
      return 0;
    });
    setContents(ordered.map((locale) => ({
      locale,
      name: '',
      description: '',
      status: 'idle',
    })));
    setStep('content');
  };

  const updateContent = (locale: string, patch: Partial<PendingLocaleContent>) => {
    setContents((prev) => prev.map((c) => c.locale === locale ? { ...c, ...patch } : c));
  };

  const save = async () => {
    setSaving(true);
    for (const c of contents) {
      if (!c.name.trim()) continue;
      updateContent(c.locale, { status: 'saving', error: null });
      try {
        await product.addLocalization({
          locale: c.locale,
          name: c.name.trim(),
          description: c.description.trim() || null,
        });
        updateContent(c.locale, { status: 'saved' });
      } catch (err) {
        updateContent(c.locale, { status: 'error', error: (err as Error).message });
      }
    }
    setSaving(false);
    const allSaved = contents.every((c) => c.status === 'saved' || !c.name.trim());
    if (allSaved) {
      setTimeout(() => onClose(), 600);
    }
  };

  const savableCount = contents.filter((c) => c.name.trim().length > 0).length;
  const savedCount = contents.filter((c) => c.status === 'saved').length;
  const canSave = !saving && savableCount > 0;

  return (
    <div className="app-picker-backdrop" onClick={onClose}>
      <div
        className="app-picker-modal locale-manager-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Add languages"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="locale-manager-titlebar">
          <h3 className="locale-manager-title">
            {step === 'select'
              ? `Add Languages · ${config.productLabel}`
              : `Add ${selected.size} Language${selected.size === 1 ? '' : 's'}`}
          </h3>
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

        {step === 'select' && (
          <>
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

            <div
              className="locale-manager-body"
              style={{ display: 'flex', flexDirection: 'column', gap: 0 }}
            >
              <div
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 16px', color: 'var(--text-muted)', fontSize: 12,
                }}
              >
                <span>Select languages to add</span>
                {selected.size > 0 && (
                  <span
                    style={{
                      padding: '2px 10px', borderRadius: 99,
                      background: 'var(--accent-light)', color: 'var(--accent)',
                      fontWeight: 600, fontSize: 11,
                    }}
                  >
                    {selected.size} selected
                  </span>
                )}
              </div>

              <ul className="locale-manager-list" style={{ padding: 0 }}>
                {filtered.map((l) => {
                  const added = taken.has(l.code);
                  const locked = isPrimaryLocked(l.code);
                  const disabled = added || locked;
                  const isSelected = selected.has(l.code);
                  return (
                    <li key={l.code} className={`locale-manager-row ${added ? 'is-active' : 'is-available'}`}>
                      <button
                        type="button"
                        className="locale-manager-row-button"
                        onClick={() => toggle(l.code)}
                        disabled={disabled}
                        style={{ opacity: added ? 0.55 : 1, cursor: disabled ? 'default' : 'pointer' }}
                      >
                        <span className="locale-manager-row-text">
                          <span className="locale-manager-row-name">
                            {l.displayName}
                            {locked && (
                              <span className="locale-manager-badge tone-primary" style={{ marginLeft: 8 }}>Primary</span>
                            )}
                            {added && <span className="locale-manager-badge tone-primary" style={{ marginLeft: 8 }}>Added</span>}
                          </span>
                          <span className="locale-manager-row-code">{l.code}</span>
                        </span>
                        {!added && (
                          <span
                            aria-hidden
                            style={{
                              width: 22, height: 22, borderRadius: 6,
                              border: '1.5px solid ' + (isSelected ? 'var(--accent)' : 'var(--border)'),
                              background: isSelected ? 'var(--accent)' : 'transparent',
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                              color: 'white',
                            }}
                          >
                            {isSelected && (
                              <svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M5 10l3 3 7-7"/>
                              </svg>
                            )}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="locale-manager-footer">
              <span className="locale-manager-footer-text" style={{ color: 'var(--text-muted)' }}>
                Removal happens from the Localizations table.
              </span>
              <div className="locale-manager-footer-actions">
                <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={goNext}
                  disabled={selected.size === 0}
                >
                  Next ({selected.size})
                </button>
              </div>
            </div>
          </>
        )}

        {step === 'content' && (
          <>
            <div className="locale-manager-body" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {source && source.name && (
                <div
                  style={{
                    padding: 12, borderRadius: 8,
                    background: 'var(--bg)', border: '1px solid var(--border)',
                  }}
                >
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
                    Source · {localeDisplayName(source.locale) || source.locale}
                  </div>
                  <div style={{ fontWeight: 600 }}>{source.name}</div>
                  {source.description && (
                    <div className="muted" style={{ marginTop: 4 }}>{source.description}</div>
                  )}
                </div>
              )}

              {/* Panel-position plugin slot — drives the iOS-style
                  "Auto Generate" + "AI Translate All" cards. Renders
                  nothing when no plugin handles `meta.mode === 'panel'`,
                  so the existing inline slots remain the only AI surface
                  if no panel-aware plugin is installed. */}
              {(() => {
                const primaryContent = contents.find((c) => c.locale === primaryLocale);
                const nonPrimaryContents = contents.filter((c) => c.locale !== primaryLocale);
                const effectivePrimaryName = primaryContent?.name ?? source?.name ?? '';
                const effectivePrimaryDescription =
                  primaryContent?.description ?? source?.description ?? '';

                const relatedFields = primaryContent
                  ? {
                      description: {
                        kind: config.slotKinds.description,
                        text: primaryContent.description,
                        onChange: (v: string) =>
                          updateContent(primaryLocale, { description: v }),
                        maxLength: config.descriptionLimit,
                      },
                    }
                  : undefined;

                const batch = nonPrimaryContents.length > 0 && effectivePrimaryName
                  ? {
                      sourceLocale: primaryLocale,
                      sourceText: effectivePrimaryName,
                      sourceRelated: { description: effectivePrimaryDescription },
                      targets: nonPrimaryContents.map((t) => ({
                        locale: t.locale,
                        current: t.name,
                        setText: (v: string) => updateContent(t.locale, { name: v }),
                        relatedFields: {
                          description: {
                            kind: config.slotKinds.description,
                            text: t.description,
                            onChange: (v: string) =>
                              updateContent(t.locale, { description: v }),
                            maxLength: config.descriptionLimit,
                          },
                        },
                      })),
                    }
                  : undefined;

                if (!batch && !relatedFields) return null;

                return (
                  <PluginSlot
                    slot="text.edit"
                    ctx={{
                      slot: 'text.edit',
                      kind: config.slotKinds.name,
                      text: effectivePrimaryName,
                      onChange: primaryContent
                        ? (v) => updateContent(primaryLocale, { name: v })
                        : () => { /* primary already saved — panel is read-only for it */ },
                      locale: primaryLocale,
                      maxLength: config.nameLimit,
                      app: workspace.currentApp ?? undefined,
                      meta: {
                        mode: 'panel',
                        productLabel: config.productLabel,
                      },
                      batch,
                      relatedFields,
                    }}
                  />
                );
              })()}

              {contents.map((c) => {
                const isPrimaryRow = c.locale === primaryLocale;
                const isEmpty = !c.name.trim() && !c.description.trim();
                const isEdited = c.status === 'idle' && !isEmpty;
                return (
                <div
                  key={c.locale}
                  style={{
                    padding: 12, borderRadius: 8,
                    border: '1px solid var(--border)',
                    background: 'var(--bg-card, white)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <strong>{localeDisplayName(c.locale) || c.locale}</strong>
                        {isPrimaryRow && (
                          <span className="platform-badge" style={{ fontSize: 9 }}>SOURCE</span>
                        )}
                        {isEmpty && c.status === 'idle' && (
                          <span className="status pending" style={{ fontSize: 10 }}>Empty</span>
                        )}
                        {isEdited && (
                          <span className="status live" style={{ fontSize: 10 }}>Edited</span>
                        )}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
                        {c.locale}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      {c.status === 'saved' && <span className="status live">Saved</span>}
                      {c.status === 'saving' && <span className="status pending">Saving…</span>}
                      {c.status === 'error' && <span className="status rejected">Error</span>}
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div>
                      <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>Display Name</span>
                        <span className="form-hint">{c.name.length}/{config.nameLimit}</span>
                      </label>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <input
                          className="form-input"
                          value={c.name}
                          placeholder="Display name shown to users"
                          onChange={(e) => updateContent(c.locale, { name: e.target.value })}
                          disabled={c.status === 'saving' || c.status === 'saved'}
                          style={{ flex: 1 }}
                        />
                        <PluginSlot
                          slot="text.edit"
                          ctx={{
                            slot: 'text.edit',
                            kind: config.slotKinds.name,
                            text: c.name,
                            onChange: (v) => updateContent(c.locale, { name: v }),
                            locale: c.locale,
                            maxLength: config.nameLimit,
                            app: workspace.currentApp ?? undefined,
                            meta: { productLabel: config.productLabel },
                            batch: source && source.name ? {
                              sourceLocale: source.locale,
                              sourceText: source.name,
                              targets: [{
                                locale: c.locale,
                                current: c.name,
                                setText: (v) => updateContent(c.locale, { name: v }),
                              }],
                            } : undefined,
                          }}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>Description</span>
                        <span className="form-hint">{c.description.length}/{config.descriptionLimit}</span>
                      </label>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <input
                          className="form-input"
                          value={c.description}
                          placeholder="Short description"
                          onChange={(e) => updateContent(c.locale, { description: e.target.value })}
                          disabled={c.status === 'saving' || c.status === 'saved'}
                          style={{ flex: 1 }}
                        />
                        <PluginSlot
                          slot="text.edit"
                          ctx={{
                            slot: 'text.edit',
                            kind: config.slotKinds.description,
                            text: c.description,
                            onChange: (v) => updateContent(c.locale, { description: v }),
                            locale: c.locale,
                            maxLength: config.descriptionLimit,
                            app: workspace.currentApp ?? undefined,
                            meta: { productLabel: config.productLabel },
                            batch: source && source.description ? {
                              sourceLocale: source.locale,
                              sourceText: source.description,
                              targets: [{
                                locale: c.locale,
                                current: c.description,
                                setText: (v) => updateContent(c.locale, { description: v }),
                              }],
                            } : undefined,
                          }}
                        />
                      </div>
                    </div>
                    {c.error && (
                      <div className="form-hint" style={{ color: 'var(--danger-text)' }}>{c.error}</div>
                    )}
                  </div>
                </div>
                );
              })}
            </div>

            <div className="locale-manager-footer">
              <span className="locale-manager-footer-text" style={{ color: 'var(--text-muted)' }}>
                {savedCount > 0
                  ? `Saved ${savedCount}/${contents.length}`
                  : `${savableCount} of ${contents.length} ready to save`}
              </span>
              <div className="locale-manager-footer-actions">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setStep('select')}
                  disabled={saving}
                >
                  Back
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={save}
                  disabled={!canSave}
                >
                  {saving ? `Saving ${savedCount}/${savableCount}…` : `Save ${savableCount}`}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export const AddLanguagesSheet = observer(AddLanguagesSheetImpl) as typeof AddLanguagesSheetImpl;
