import { useEffect, useMemo, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import type { Subscription } from '../Subscription.ts';
import {
  SUBSCRIPTION_LOCALIZATION_NAME_LIMIT,
  SUBSCRIPTION_LOCALIZATION_DESCRIPTION_LIMIT,
} from '../SubscriptionLocalization.ts';
import {
  APP_STORE_LOCALES,
  localeDisplayName,
} from '../../../shared/AppStoreLocaleRegistry.ts';
import { getLocalizationAIService } from '../../AILocalizationService.ts';

interface Props {
  open: boolean;
  sub: Subscription;
  onClose: () => void;
}

type Step = 'select' | 'content';

interface PendingLocaleContent {
  locale: string;
  name: string;
  description: string;
  status: 'idle' | 'translating' | 'translated' | 'saving' | 'saved' | 'error';
  error?: string | null;
}

/** Add Languages sheet for a subscription tier — mirrors IAPLocalePickerSheet
 *  and the iOS multi-language sheet. Two-step: pick locales, then fill
 *  content (with AI batch translate when a plugin is registered). */
function SubscriptionLocalePickerSheetImpl({ open, sub, onClose }: Props) {
  const [step, setStep] = useState<Step>('select');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [contents, setContents] = useState<PendingLocaleContent[]>([]);
  const [batchRunning, setBatchRunning] = useState(false);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const aiService = getLocalizationAIService();
  const source = sub.localizations[0] ?? null;

  useEffect(() => {
    if (!open) return;
    setStep('select');
    setQuery('');
    setSelected(new Set());
    setContents([]);
    setBatchRunning(false);
    setSaving(false);
    requestAnimationFrame(() => inputRef.current?.focus());
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const taken = useMemo(
    () => new Set(sub.localizations.map((l) => l.locale)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [open, sub.localizations.length],
  );

  if (!open) return null;

  const needle = query.trim().toLowerCase();
  const filtered = APP_STORE_LOCALES.filter((l) =>
    !needle || `${l.displayName} ${l.code}`.toLowerCase().includes(needle),
  );

  const toggle = (code: string) => {
    if (taken.has(code)) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const goNext = () => {
    if (selected.size === 0) return;
    setContents([...selected].map((locale) => ({
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

  const translateOne = async (locale: string) => {
    if (!aiService || !source || !source.name) return;
    updateContent(locale, { status: 'translating', error: null });
    try {
      const name = await aiService.translate({
        text: source.name,
        fromLocale: source.locale,
        toLocale: locale,
        context: 'Subscription tier display name',
      });
      let description = '';
      if (source.description) {
        description = await aiService.translate({
          text: source.description,
          fromLocale: source.locale,
          toLocale: locale,
          context: 'Subscription tier description',
        });
      }
      updateContent(locale, { name, description, status: 'translated' });
    } catch (err) {
      updateContent(locale, { status: 'error', error: (err as Error).message });
    }
  };

  const translateAll = async () => {
    if (!aiService || !source || !source.name) return;
    setBatchRunning(true);
    for (const c of contents) {
      await translateOne(c.locale);
    }
    setBatchRunning(false);
  };

  const save = async () => {
    setSaving(true);
    for (const c of contents) {
      if (!c.name.trim()) continue;
      updateContent(c.locale, { status: 'saving', error: null });
      try {
        await sub.addLocalization({
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
              ? 'Add Languages'
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
                  const isSelected = selected.has(l.code);
                  return (
                    <li key={l.code} className={`locale-manager-row ${added ? 'is-active' : 'is-available'}`}>
                      <button
                        type="button"
                        className="locale-manager-row-button"
                        onClick={() => toggle(l.code)}
                        disabled={added}
                        style={{ opacity: added ? 0.55 : 1, cursor: added ? 'default' : 'pointer' }}
                      >
                        <span className="locale-manager-row-text">
                          <span className="locale-manager-row-name">
                            {l.displayName}
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

              {aiService && source && source.name && (
                <div
                  style={{
                    padding: 12, borderRadius: 8,
                    background: 'var(--accent-light)',
                    display: 'flex', alignItems: 'center', gap: 12,
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>✨ Translate All</div>
                    <div className="form-hint">
                      Auto-fill all {contents.length} languages from the source via the registered AI plugin.
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={translateAll}
                    disabled={batchRunning || saving}
                  >
                    {batchRunning ? 'Translating…' : 'Translate All'}
                  </button>
                </div>
              )}

              {contents.map((c) => (
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
                      <strong>{localeDisplayName(c.locale) || c.locale}</strong>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
                        {c.locale}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      {c.status === 'saved' && <span className="status live">Saved</span>}
                      {c.status === 'translating' && <span className="status pending">Translating…</span>}
                      {c.status === 'saving' && <span className="status pending">Saving…</span>}
                      {c.status === 'error' && <span className="status rejected">Error</span>}
                      {aiService && source && source.name && c.status !== 'saved' && c.status !== 'saving' && (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => translateOne(c.locale)}
                          disabled={c.status === 'translating' || batchRunning}
                        >
                          ✨ AI
                        </button>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div>
                      <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Display Name</span>
                        <span className="form-hint">{c.name.length}/{SUBSCRIPTION_LOCALIZATION_NAME_LIMIT}</span>
                      </label>
                      <input
                        className="form-input"
                        value={c.name}
                        placeholder="Display name shown to users"
                        onChange={(e) => updateContent(c.locale, { name: e.target.value })}
                        disabled={c.status === 'saving' || c.status === 'saved'}
                      />
                    </div>
                    <div>
                      <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Description</span>
                        <span className="form-hint">{c.description.length}/{SUBSCRIPTION_LOCALIZATION_DESCRIPTION_LIMIT}</span>
                      </label>
                      <input
                        className="form-input"
                        value={c.description}
                        placeholder="Short description"
                        onChange={(e) => updateContent(c.locale, { description: e.target.value })}
                        disabled={c.status === 'saving' || c.status === 'saved'}
                      />
                    </div>
                    {c.error && (
                      <div className="form-hint" style={{ color: 'var(--danger-text)' }}>{c.error}</div>
                    )}
                  </div>
                </div>
              ))}
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

export const SubscriptionLocalePickerSheet = observer(SubscriptionLocalePickerSheetImpl);
