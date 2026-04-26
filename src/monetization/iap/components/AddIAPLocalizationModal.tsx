import { useEffect, useMemo, useState } from 'react';
import { observer } from 'mobx-react-lite';
import type { InAppPurchase } from '../InAppPurchase.ts';
import { IAP_LOCALIZATION_NAME_LIMIT } from '../InAppPurchaseLocalization.ts';
import {
  APP_STORE_LOCALES,
  localeDisplayName,
} from '../../../shared/AppStoreLocaleRegistry.ts';

interface Props {
  iap: InAppPurchase;
  open: boolean;
  onClose: () => void;
}

/**
 * Add a new localization to an IAP. Mirrors the iOS prototype's "Add
 * Language" sheet for IAPs but stays single-step — pick locale, type the
 * initial display name, save. Locales that the IAP already has are
 * filtered out so the user can't pick a duplicate.
 */
function AddIAPLocalizationModalImpl({ iap, open, onClose }: Props) {
  const [locale, setLocale] = useState<string>('');
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const availableLocales = useMemo(() => {
    const taken = new Set(iap.localizations.map((l) => l.locale));
    return APP_STORE_LOCALES.filter((l) => !taken.has(l.code));
  }, [iap.localizations, open]);

  useEffect(() => {
    if (!open) return;
    setLocale(availableLocales[0]?.code ?? '');
    setName('');
    setError(null);
    setSubmitting(false);
  }, [open, availableLocales]);

  if (!open) return null;

  const trimmedName = name.trim();
  const nameOver = name.length > IAP_LOCALIZATION_NAME_LIMIT;
  const canSubmit = !!locale && !!trimmedName && !nameOver && !submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await iap.addLocalization({ locale, name: trimmedName });
      onClose();
    } catch (err) {
      setError((err as Error).message);
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay open" onClick={onClose}>
      <form
        className="modal"
        style={{ maxWidth: 480 }}
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <div className="modal-header">
          <h3>Add Language · {iap.referenceName}</h3>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="modal-body">
          {availableLocales.length === 0 ? (
            <div className="form-hint">All App Store locales are already added.</div>
          ) : (
            <>
              <div className="form-group">
                <label className="form-label" htmlFor="add-loc">Language</label>
                <select
                  id="add-loc"
                  className="form-input"
                  value={locale}
                  onChange={(e) => setLocale(e.target.value)}
                  autoFocus
                >
                  {availableLocales.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.displayName} ({l.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="add-name">
                  Display Name *
                  <span
                    className="form-hint"
                    style={{ marginLeft: 8, color: nameOver ? 'var(--danger-text)' : undefined }}
                  >
                    {name.length}/{IAP_LOCALIZATION_NAME_LIMIT}
                  </span>
                </label>
                <input
                  id="add-name"
                  className="form-input"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={localeDisplayName(locale)}
                />
                <div className="form-hint">
                  Description can be added after creation.
                </div>
              </div>

              {error && (
                <div className="form-hint" style={{ color: 'var(--danger-text)' }}>{error}</div>
              )}
            </>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={!canSubmit}>
            {submitting ? 'Adding…' : 'Add'}
          </button>
        </div>
      </form>
    </div>
  );
}

export const AddIAPLocalizationModal = observer(AddIAPLocalizationModalImpl);
