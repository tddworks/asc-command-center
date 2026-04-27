import { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { iaps } from '../iapsInstance.ts';
import { workspace } from '../../../workspace/workspaceInstance.ts';
import { InAppPurchase, InAppPurchaseType } from '../InAppPurchase.ts';
import { PluginSlot } from '../../../extensibility/plugin/PluginSlot.tsx';

interface Props {
  open: boolean;
  onClose: () => void;
}

const TYPE_OPTIONS: { value: InAppPurchaseType; label: string; subtitle: string }[] = [
  { value: InAppPurchaseType.Consumable, label: 'Consumable', subtitle: 'Users can buy multiple times' },
  { value: InAppPurchaseType.NonConsumable, label: 'Non-Consumable', subtitle: 'Buy once, keep forever' },
  { value: InAppPurchaseType.NonRenewingSubscription, label: 'Non-Renewing Subscription', subtitle: 'Time-limited access' },
];

/**
 * Create IAP sheet. Mirrors the iOS prototype's New Purchase form:
 * type picker (3 options), reference name, product ID with auto-suggestion
 * derived from `workspace.currentApp.bundleId`. Editing the reference name
 * keeps re-suggesting the product ID until the user types in the product
 * ID field directly.
 */
function CreateIAPModalImpl({ open, onClose }: Props) {
  const app = workspace.currentApp;
  const bundleId = app?.bundleId ?? '';

  const [type, setType] = useState<InAppPurchaseType>(InAppPurchaseType.Consumable);
  const [referenceName, setReferenceName] = useState('');
  const [productId, setProductId] = useState('');
  const [productIdDirty, setProductIdDirty] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setType(InAppPurchaseType.Consumable);
    setReferenceName('');
    setProductId('');
    setProductIdDirty(false);
    setError(null);
    setSubmitting(false);
  }, [open]);

  useEffect(() => {
    if (!open || productIdDirty) return;
    setProductId(InAppPurchase.suggestedProductId(bundleId, referenceName));
  }, [referenceName, bundleId, productIdDirty, open]);

  if (!open) return null;

  const trimmedName = referenceName.trim();
  const trimmedId = productId.trim();
  const canSubmit = !!trimmedName && !!trimmedId && !!app && !submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !app) return;
    setSubmitting(true);
    setError(null);
    try {
      await iaps.create({
        appId: app.id,
        referenceName: trimmedName,
        productId: trimmedId,
        inAppPurchaseType: type,
      });
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
        style={{ maxWidth: 520 }}
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <div className="modal-header">
          <h3>New In-App Purchase</h3>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="modal-body">
          {!app && (
            <div className="form-hint" style={{ color: 'var(--danger-text)' }}>
              No app selected. Pick an app from the sidebar first.
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Type</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {TYPE_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10,
                    padding: '10px 12px', border: '1px solid var(--border)',
                    borderRadius: 8,
                    background: type === opt.value ? 'var(--accent-light)' : 'transparent',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="radio"
                    name="iap-type"
                    value={opt.value}
                    checked={type === opt.value}
                    onChange={() => setType(opt.value)}
                    style={{ marginTop: 2 }}
                  />
                  <div>
                    <div style={{ fontWeight: 600 }}>{opt.label}</div>
                    <div className="form-hint" style={{ marginTop: 2 }}>{opt.subtitle}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label
              className="form-label"
              htmlFor="iap-ref"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
            >
              <span>Reference Name *</span>
              {app && (
                <PluginSlot
                  slot="text.edit"
                  ctx={{
                    slot: 'text.edit',
                    kind: 'iapCreate.referenceName',
                    text: referenceName,
                    onChange: (v) => setReferenceName(v),
                    locale: 'en-US',
                    app,
                    meta: { iapType: type },
                  }}
                />
              )}
            </label>
            <input
              id="iap-ref"
              className="form-input"
              type="text"
              value={referenceName}
              placeholder="Internal name"
              onChange={(e) => setReferenceName(e.target.value)}
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="iap-pid">
              Product ID * {!productIdDirty && <span className="form-hint" style={{ marginLeft: 6 }}>(auto)</span>}
            </label>
            <input
              id="iap-pid"
              className="form-input"
              type="text"
              value={productId}
              placeholder="e.g. com.app.coins"
              onChange={(e) => { setProductIdDirty(true); setProductId(e.target.value); }}
              style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}
            />
            <div className="form-hint">Auto-derived from bundle ID and reference name. Edit to override.</div>
          </div>

          {error && (
            <div className="form-hint" style={{ color: 'var(--danger-text)' }}>{error}</div>
          )}

          <div className="form-hint" style={{ marginTop: 12 }}>
            After creation you'll need to add at least one localization and set pricing
            before submitting for review.
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={!canSubmit}>
            {submitting ? 'Creating…' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  );
}

export const CreateIAPModal = observer(CreateIAPModalImpl);
