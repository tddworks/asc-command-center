import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import type {
  LocalizationLike,
  LocalizationsConfig,
  ProductWithLocalizations,
} from './LocalizableProduct.ts';
import { localeDisplayName } from '../../shared/AppStoreLocaleRegistry.ts';
import { PluginSlot } from '../../extensibility/plugin/PluginSlot.tsx';
import type { BatchTargets } from '../../extensibility/plugin/slots.ts';
import { workspace } from '../../workspace/workspaceInstance.ts';
import { AddLanguagesSheet } from './AddLanguagesSheet.tsx';

interface Props<L extends LocalizationLike, P extends ProductWithLocalizations<L>> {
  product: P;
  config: LocalizationsConfig;
}

interface RowProps<L extends LocalizationLike, P extends ProductWithLocalizations<L>> {
  product: P;
  loc: L;
  /** Pre-built batch targets for the source row; `undefined` for non-source
   *  rows. The shared slot reads this to expose the "All" fan-out button
   *  only on the primary locale. */
  nameBatch?: BatchTargets;
  descriptionBatch?: BatchTargets;
  isSource: boolean;
  config: LocalizationsConfig;
  editing: boolean;
  onEdit: () => void;
  onDone: () => void;
}

function LocaleRow<L extends LocalizationLike, P extends ProductWithLocalizations<L>>({
  product, loc, nameBatch, descriptionBatch, isSource, config, editing, onEdit, onDone,
}: RowProps<L, P>) {
  const [busy, setBusy] = useState<'save' | 'delete' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const done = async () => {
    // Done always exits edit mode. If the user actually changed something
    // (and the backend allows it), persist first; otherwise it's a no-op
    // exit — same as Cancel without the discard step.
    if (!loc.hasUnsavedChanges || !loc.canUpdate) {
      onDone();
      return;
    }
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

  const remove = async () => {
    if (!loc.canDelete) return;
    if (!confirm(`Remove ${localeDisplayName(loc.locale) || loc.locale}?`)) return;
    setBusy('delete'); setError(null);
    try {
      await product.removeLocalization(loc);
    } catch (err) {
      setError((err as Error).message);
      setBusy(null);
    }
  };

  const nameOver = loc.nameRemaining < 0;
  const descOver = loc.descriptionRemaining < 0;

  return (
    <tr>
      <td className="cell-primary">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span>
            {localeDisplayName(loc.locale) || loc.locale || '(unknown locale)'}
            {isSource && (
              <span className="platform-badge" style={{ marginLeft: 8, fontSize: 9 }}>SOURCE</span>
            )}
            {!loc.isComplete && (
              <span className="status pending" style={{ marginLeft: 8 }}>Incomplete</span>
            )}
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
            {loc.locale || loc.id || '—'}
          </span>
        </div>
      </td>

      <td>
        {editing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input
                className="form-input"
                value={loc.name}
                placeholder="Display name"
                onChange={(e) => loc.setName(e.target.value)}
                maxLength={config.nameLimit + 10}
                style={{ flex: 1 }}
              />
              <PluginSlot
                slot="text.edit"
                ctx={{
                  slot: 'text.edit',
                  kind: config.slotKinds.name,
                  text: loc.name,
                  onChange: (v) => loc.setName(v),
                  locale: loc.locale,
                  maxLength: config.nameLimit,
                  app: workspace.currentApp ?? undefined,
                  meta: { productLabel: config.productLabel },
                  batch: nameBatch,
                }}
              />
            </div>
            <span className="form-hint" style={{ color: nameOver ? 'var(--danger-text)' : undefined }}>
              {(loc.name?.length ?? 0)}/{config.nameLimit}
            </span>
          </div>
        ) : (
          loc.name || <span style={{ color: 'var(--text-muted)' }}>—</span>
        )}
      </td>

      <td>
        {editing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input
                className="form-input"
                value={loc.description ?? ''}
                placeholder="Description"
                onChange={(e) => loc.setDescription(e.target.value || null)}
                maxLength={config.descriptionLimit + 10}
                style={{ flex: 1 }}
              />
              <PluginSlot
                slot="text.edit"
                ctx={{
                  slot: 'text.edit',
                  kind: config.slotKinds.description,
                  text: loc.description ?? '',
                  onChange: (v) => loc.setDescription(v || null),
                  locale: loc.locale,
                  maxLength: config.descriptionLimit,
                  app: workspace.currentApp ?? undefined,
                  meta: { productLabel: config.productLabel },
                  batch: descriptionBatch,
                }}
              />
            </div>
            <span className="form-hint" style={{ color: descOver ? 'var(--danger-text)' : undefined }}>
              {(loc.description?.length ?? 0)}/{config.descriptionLimit}
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
                onClick={done}
                disabled={nameOver || descOver || !!busy || (loc.hasUnsavedChanges && !loc.canUpdate)}
                title={
                  loc.hasUnsavedChanges && !loc.canUpdate
                    ? 'Backend does not allow updating this locale'
                    : undefined
                }
              >
                {busy === 'save' ? 'Saving…' : 'Done'}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={onEdit}
                disabled={!loc.canUpdate}
              >
                Edit
              </button>
              {loc.canDelete && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={remove}
                  disabled={!!busy}
                  title={isSource ? 'Remove the source locale (you can re-add it later)' : undefined}
                >
                  {busy === 'delete' ? 'Removing…' : 'Remove'}
                </button>
              )}
            </>
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

const ObservedLocaleRow = observer(LocaleRow) as typeof LocaleRow;

/** Build the cross-locale `BatchTargets` payload the source row's slot
 *  carries to drive the plugin's "All" fan-out button. Each target is a
 *  non-source locale with a setter for the requested field. */
function buildBatch<L extends LocalizationLike>(
  source: L,
  targets: readonly L[],
  field: 'name' | 'description',
): BatchTargets {
  return {
    sourceLocale: source.locale,
    sourceText: field === 'name' ? source.name : (source.description ?? ''),
    targets: targets.map((t) => ({
      locale: t.locale,
      current: field === 'name' ? t.name : (t.description ?? ''),
      setText: (v: string) => {
        if (field === 'name') t.setName(v);
        else t.setDescription(v || null);
      },
    })),
  };
}

function LocalizationsTabImpl<L extends LocalizationLike, P extends ProductWithLocalizations<L>>({
  product, config,
}: Props<L, P>) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editingLocale, setEditingLocale] = useState<string | null>(null);

  if (!product.canViewLocalizations) {
    return <div className="card-body padded"><span className="muted">This backend does not expose localizations.</span></div>;
  }
  if (!product.isLocalizationsLoaded) {
    return <div className="loading"><span className="spinner" /><span>Loading localizations…</span></div>;
  }

  // The SOURCE row is the app's primary locale (e.g. en-US), not whichever
  // row happens to be first in the backend's response. iOS uses the same
  // rule — the SOURCE badge follows `app.primaryLocale`.
  const source =
    product.localizations.find((l) => l.locale === config.primaryLocale) ??
    product.localizations[0] ??
    null;
  const nonSourceLocales = source
    ? product.localizations.filter((l) => l !== source)
    : product.localizations;
  const nameBatch = source ? buildBatch(source, nonSourceLocales, 'name') : undefined;
  const descriptionBatch = source ? buildBatch(source, nonSourceLocales, 'description') : undefined;
  const incompleteCount = product.localizations.filter((l) => !l.isComplete).length;

  // Render order: source first, then the rest in backend order. Mirrors the
  // iOS Localizations tab where the primary locale is always the top card.
  const orderedLocalizations = source
    ? [source, ...nonSourceLocales]
    : product.localizations;

  return (
    <>
      <div className="card">
        <div className="toolbar">
          <div className="toolbar-left">
            <h3>Localizations</h3>
            <span className="muted" style={{ marginLeft: 8 }}>
              {product.localizations.length} language{product.localizations.length === 1 ? '' : 's'}
              {incompleteCount > 0 && ` · ${incompleteCount} incomplete`}
            </span>
          </div>
          <div className="toolbar-right">
            {product.canCreateLocalization && (
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

        {product.localizations.length === 0 ? (
          <div className="card-body" style={{ textAlign: 'center', padding: 32 }}>
            <div style={{ fontSize: 32, opacity: 0.4 }}>🌐</div>
            <h4 style={{ marginTop: 8 }}>No localizations yet</h4>
            <p className="muted" style={{ marginTop: 4 }}>
              Add at least one language before submitting for review.
            </p>
            {product.canCreateLocalization && (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                style={{ marginTop: 12 }}
                onClick={() => setPickerOpen(true)}
              >
                + Add Languages
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
                {orderedLocalizations.map((loc) => {
                  const isSource = loc === source;
                  return (
                  <ObservedLocaleRow
                    key={loc.id || loc.locale || `row-${orderedLocalizations.indexOf(loc)}`}
                    product={product}
                    loc={loc}
                    isSource={isSource}
                    nameBatch={isSource ? nameBatch : undefined}
                    descriptionBatch={isSource ? descriptionBatch : undefined}
                    config={config}
                    editing={editingLocale === loc.locale}
                    onEdit={() => setEditingLocale(loc.locale)}
                    onDone={() => setEditingLocale(null)}
                  />
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AddLanguagesSheet
        open={pickerOpen}
        product={product}
        config={config}
        onClose={() => setPickerOpen(false)}
      />
    </>
  );
}

export const LocalizationsTab = observer(LocalizationsTabImpl) as typeof LocalizationsTabImpl;
