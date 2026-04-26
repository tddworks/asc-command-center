import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import {
  SUBSCRIPTION_LOCALIZATION_DESCRIPTION_LIMIT,
  SUBSCRIPTION_LOCALIZATION_NAME_LIMIT,
  type SubscriptionLocalization,
} from '../SubscriptionLocalization.ts';
import type { Subscription } from '../Subscription.ts';
import { localeDisplayName } from '../../../shared/AppStoreLocaleRegistry.ts';
import { getLocalizationAIService } from '../../AILocalizationService.ts';
import { AddSubscriptionLocalizationModal } from './AddSubscriptionLocalizationModal.tsx';

interface Props {
  sub: Subscription;
}

function LocaleCard({ sub, loc }: { sub: Subscription; loc: SubscriptionLocalization }) {
  const [busy, setBusy] = useState<'save' | 'delete' | 'ai' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const aiService = getLocalizationAIService();
  const source = sub.localizations[0];
  const isSource = !source || source.locale === loc.locale;
  const canAI = !isSource && !!aiService && !!source && !!source.name;

  const aiTranslate = async () => {
    if (!aiService || !source) return;
    setBusy('ai'); setError(null);
    try {
      const translatedName = await aiService.translate({
        text: source.name,
        fromLocale: source.locale,
        toLocale: loc.locale,
        context: 'Subscription tier display name',
      });
      loc.setName(translatedName);
      if (source.description) {
        const translatedDesc = await aiService.translate({
          text: source.description,
          fromLocale: source.locale,
          toLocale: loc.locale,
          context: 'Subscription tier description',
        });
        loc.setDescription(translatedDesc);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const save = async () => {
    setBusy('save'); setError(null);
    try { await loc.save(); }
    catch (err) { setError((err as Error).message); }
    finally { setBusy(null); }
  };
  const remove = async () => {
    if (!loc.canDelete) return;
    if (!window.confirm(`Remove ${localeDisplayName(loc.locale)} localization?`)) return;
    setBusy('delete'); setError(null);
    try { await sub.removeLocalization(loc); }
    catch (err) { setError((err as Error).message); setBusy(null); }
  };

  const nameOver = loc.nameRemaining < 0;
  const descOver = loc.descriptionRemaining < 0;

  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <div className="toolbar">
        <div className="toolbar-left">
          <strong>{localeDisplayName(loc.locale)}</strong>
          <span className="muted" style={{ marginLeft: 8, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
            {loc.locale}
          </span>
          {!loc.isComplete && (
            <span className="status pending" style={{ marginLeft: 8 }}>Incomplete</span>
          )}
        </div>
        <div className="toolbar-right" style={{ display: 'flex', gap: 6 }}>
          {loc.hasUnsavedChanges && !loc.isNew && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => loc.discard()} disabled={!!busy}>
              Discard
            </button>
          )}
          {loc.canDelete && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={remove} disabled={!!busy}>
              {busy === 'delete' ? 'Removing…' : 'Remove'}
            </button>
          )}
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={save}
            disabled={!loc.hasUnsavedChanges || nameOver || descOver || !!busy || !loc.canUpdate}
            title={!loc.canUpdate ? 'Backend does not allow updating this locale' : undefined}
          >
            {busy === 'save' ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      <div className="card-body">
        <div className="form-group">
          <label className="form-label">
            Display Name
            <span className="form-hint" style={{ marginLeft: 8, color: nameOver ? 'var(--danger-text)' : undefined }}>
              {(loc.name?.length ?? 0)}/{SUBSCRIPTION_LOCALIZATION_NAME_LIMIT}
            </span>
          </label>
          <input
            className="form-input"
            type="text"
            value={loc.name}
            onChange={(e) => loc.setName(e.target.value)}
            placeholder="e.g. Premium Monthly"
          />
        </div>

        <div className="form-group">
          <label className="form-label">
            Description
            <span className="form-hint" style={{ marginLeft: 8, color: descOver ? 'var(--danger-text)' : undefined }}>
              {(loc.description?.length ?? 0)}/{SUBSCRIPTION_LOCALIZATION_DESCRIPTION_LIMIT}
            </span>
          </label>
          <input
            className="form-input"
            type="text"
            value={loc.description ?? ''}
            onChange={(e) => loc.setDescription(e.target.value || null)}
            placeholder="Short user-facing description"
          />
        </div>

        {error && (
          <div className="form-hint" style={{ color: 'var(--danger-text)' }}>{error}</div>
        )}
      </div>
    </div>
  );
}

const ObservedLocaleCard = observer(LocaleCard);

function SubscriptionLocalizationsTabImpl({ sub }: Props) {
  const [addOpen, setAddOpen] = useState(false);

  if (!sub.canViewLocalizations) {
    return <div className="card-body"><span className="muted">This backend does not expose localizations for this tier.</span></div>;
  }
  if (!sub.isLocalizationsLoaded) {
    return <div className="loading"><span className="spinner" /><span>Loading localizations…</span></div>;
  }

  const incompleteCount = sub.localizations.filter((l) => !l.isComplete).length;

  return (
    <>
      {sub.localizations.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 32 }}>
          <div style={{ fontSize: 32, opacity: 0.4 }}>🌐</div>
          <h4 style={{ marginTop: 8 }}>No localizations yet</h4>
          <p className="muted" style={{ marginTop: 4 }}>
            Add your first localization to start completing this tier's metadata.
          </p>
          {sub.canCreateLocalization && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              style={{ marginTop: 12 }}
              onClick={() => setAddOpen(true)}
            >
              + Add Language
            </button>
          )}
        </div>
      ) : (
        <>
          {incompleteCount > 0 && (
            <div className="card" style={{ marginBottom: 12, borderLeft: '3px solid var(--warning-bg, #f59e0b)' }}>
              <div className="card-body">
                <strong>Incomplete</strong> · {incompleteCount} locale{incompleteCount === 1 ? '' : 's'} missing a display name.
              </div>
            </div>
          )}
          {sub.localizations.map((loc) => (
            <ObservedLocaleCard key={loc.locale} sub={sub} loc={loc} />
          ))}
          {sub.canCreateLocalization && (
            <div className="card" style={{ borderStyle: 'dashed' }}>
              <div className="card-body" style={{ textAlign: 'center' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setAddOpen(true)}
                >
                  + Add Language
                </button>
              </div>
            </div>
          )}
        </>
      )}

      <AddSubscriptionLocalizationModal sub={sub} open={addOpen} onClose={() => setAddOpen(false)} />
    </>
  );
}

export const SubscriptionLocalizationsTab = observer(SubscriptionLocalizationsTabImpl);
