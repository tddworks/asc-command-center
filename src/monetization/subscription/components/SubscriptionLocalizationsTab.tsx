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
import { SubscriptionLocalePickerSheet } from './SubscriptionLocalePickerSheet.tsx';

interface Props {
  sub: Subscription;
}

interface RowProps {
  sub: Subscription;
  loc: SubscriptionLocalization;
  source: SubscriptionLocalization | null;
  isSource: boolean;
  editing: boolean;
  onEdit: () => void;
  onDone: () => void;
}

function LocaleRow({ sub, loc, source, isSource, editing, onEdit, onDone }: RowProps) {
  const [busy, setBusy] = useState<'save' | 'ai' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const aiService = getLocalizationAIService();
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
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(null); }
  };

  const save = async () => {
    setBusy('save'); setError(null);
    try {
      await loc.save();
      onDone();
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(null); }
  };

  const cancel = () => {
    loc.discard();
    setError(null);
    onDone();
  };

  void sub; // sub is reserved for future per-row actions; quiets unused-param

  const nameOver = loc.nameRemaining < 0;
  const descOver = loc.descriptionRemaining < 0;

  return (
    <tr>
      <td className="cell-primary">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span>
            {localeDisplayName(loc.locale) || loc.locale}
            {isSource && (
              <span className="platform-badge" style={{ marginLeft: 8, fontSize: 9 }}>SOURCE</span>
            )}
            {!loc.isComplete && (
              <span className="status pending" style={{ marginLeft: 8 }}>Incomplete</span>
            )}
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
            {loc.locale}
          </span>
        </div>
      </td>

      <td>
        {editing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <input
              className="form-input"
              value={loc.name}
              placeholder="Display name"
              onChange={(e) => loc.setName(e.target.value)}
              maxLength={SUBSCRIPTION_LOCALIZATION_NAME_LIMIT + 10}
            />
            <span className="form-hint" style={{ color: nameOver ? 'var(--danger-text)' : undefined }}>
              {(loc.name?.length ?? 0)}/{SUBSCRIPTION_LOCALIZATION_NAME_LIMIT}
            </span>
          </div>
        ) : (
          loc.name || <span style={{ color: 'var(--text-muted)' }}>—</span>
        )}
      </td>

      <td>
        {editing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <input
              className="form-input"
              value={loc.description ?? ''}
              placeholder="Description"
              onChange={(e) => loc.setDescription(e.target.value || null)}
              maxLength={SUBSCRIPTION_LOCALIZATION_DESCRIPTION_LIMIT + 10}
            />
            <span className="form-hint" style={{ color: descOver ? 'var(--danger-text)' : undefined }}>
              {(loc.description?.length ?? 0)}/{SUBSCRIPTION_LOCALIZATION_DESCRIPTION_LIMIT}
            </span>
          </div>
        ) : (
          loc.description || <span style={{ color: 'var(--text-muted)' }}>—</span>
        )}
      </td>

      <td style={{ textAlign: 'right' }}>
        <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
          {editing ? (
            <>
              {canAI && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={aiTranslate}
                  disabled={!!busy}
                  title={`Translate from ${localeDisplayName(source!.locale)} via AI plugin`}
                >
                  {busy === 'ai' ? 'Translating…' : '✨ AI'}
                </button>
              )}
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={cancel}
                disabled={!!busy}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={save}
                disabled={!loc.hasUnsavedChanges || nameOver || descOver || !!busy || !loc.canUpdate}
                title={!loc.canUpdate ? 'Backend does not allow updating this locale' : undefined}
              >
                {busy === 'save' ? 'Saving…' : 'Done'}
              </button>
            </>
          ) : (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={onEdit}
              disabled={!loc.canUpdate && !canAI}
            >
              Edit
            </button>
          )}
        </div>
        {error && (
          <div className="form-hint" style={{ color: 'var(--danger-text)', textAlign: 'right', marginTop: 4 }}>
            {error}
          </div>
        )}
      </td>
    </tr>
  );
}

const ObservedLocaleRow = observer(LocaleRow);

function SubscriptionLocalizationsTabImpl({ sub }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editingLocale, setEditingLocale] = useState<string | null>(null);

  if (!sub.canViewLocalizations) {
    return <div className="card-body"><span className="muted">This backend does not expose localizations for this tier.</span></div>;
  }
  if (!sub.isLocalizationsLoaded) {
    return <div className="loading"><span className="spinner" /><span>Loading localizations…</span></div>;
  }

  const source = sub.localizations[0] ?? null;
  const incompleteCount = sub.localizations.filter((l) => !l.isComplete).length;

  return (
    <>
      <div className="card">
        <div className="toolbar">
          <div className="toolbar-left">
            <h3>Localizations</h3>
            <span className="muted" style={{ marginLeft: 8 }}>
              {sub.localizations.length} language{sub.localizations.length === 1 ? '' : 's'}
              {incompleteCount > 0 && ` · ${incompleteCount} incomplete`}
            </span>
          </div>
          <div className="toolbar-right">
            {sub.canCreateLocalization && (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => setPickerOpen(true)}
              >
                + Add Languages
              </button>
            )}
          </div>
        </div>

        {sub.localizations.length === 0 ? (
          <div className="card-body" style={{ textAlign: 'center', padding: 32 }}>
            <div style={{ fontSize: 32, opacity: 0.4 }}>🌐</div>
            <h4 style={{ marginTop: 8 }}>No localizations yet</h4>
            <p className="muted" style={{ marginTop: 4 }}>
              Add at least one language before submitting for review.
            </p>
            {sub.canCreateLocalization && (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                style={{ marginTop: 12 }}
                onClick={() => setPickerOpen(true)}
              >
                + Add Language
              </button>
            )}
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Locale</th>
                  <th>Display Name</th>
                  <th>Description</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sub.localizations.map((loc, idx) => (
                  <ObservedLocaleRow
                    key={loc.locale}
                    sub={sub}
                    loc={loc}
                    source={source}
                    isSource={idx === 0}
                    editing={editingLocale === loc.locale}
                    onEdit={() => setEditingLocale(loc.locale)}
                    onDone={() => setEditingLocale(null)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <SubscriptionLocalePickerSheet open={pickerOpen} sub={sub} onClose={() => setPickerOpen(false)} />
    </>
  );
}

export const SubscriptionLocalizationsTab = observer(SubscriptionLocalizationsTabImpl);
