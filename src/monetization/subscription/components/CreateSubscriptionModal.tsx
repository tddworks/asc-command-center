import { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { workspace } from '../../../workspace/workspaceInstance.ts';
import { Subscription, SubscriptionPeriod } from '../Subscription.ts';
import type { SubscriptionGroup } from '../SubscriptionGroup.ts';
import { PluginSlot } from '../../../extensibility/plugin/PluginSlot.tsx';

interface Props {
  open: boolean;
  group: SubscriptionGroup | null;
  onClose: () => void;
}

const PERIOD_OPTIONS: { value: SubscriptionPeriod; label: string }[] = [
  { value: SubscriptionPeriod.OneWeek, label: '1 Week' },
  { value: SubscriptionPeriod.OneMonth, label: '1 Month' },
  { value: SubscriptionPeriod.TwoMonths, label: '2 Months' },
  { value: SubscriptionPeriod.ThreeMonths, label: '3 Months' },
  { value: SubscriptionPeriod.SixMonths, label: '6 Months' },
  { value: SubscriptionPeriod.OneYear, label: '1 Year' },
];

/**
 * Create a Subscription tier inside a SubscriptionGroup. Mirrors the iOS
 * prototype's "New Subscription" sheet — display name + product ID
 * (auto-suggested) + billing period (6 options) + family-sharing toggle.
 * Group level is auto-assigned (next available slot).
 */
function CreateSubscriptionModalImpl({ open, group, onClose }: Props) {
  const app = workspace.currentApp;
  const bundleId = app?.bundleId ?? '';

  const [name, setName] = useState('');
  const [productId, setProductId] = useState('');
  const [productIdDirty, setProductIdDirty] = useState(false);
  const [period, setPeriod] = useState<SubscriptionPeriod>(SubscriptionPeriod.OneMonth);
  const [familyShare, setFamilyShare] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName('');
    setProductId('');
    setProductIdDirty(false);
    setPeriod(SubscriptionPeriod.OneMonth);
    setFamilyShare(false);
    setError(null);
    setSubmitting(false);
  }, [open]);

  useEffect(() => {
    if (!open || productIdDirty) return;
    setProductId(Subscription.suggestedProductId(bundleId, name));
  }, [name, bundleId, productIdDirty, open]);

  if (!open || !group) return null;

  const trimmedName = name.trim();
  const trimmedId = productId.trim();
  const canSubmit = !!trimmedName && !!trimmedId && !submitting;
  const nextLevel = group.tierCount + 1;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await group.createSubscription({
        name: trimmedName,
        productId: trimmedId,
        subscriptionPeriod: period,
        isFamilySharable: familyShare,
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
          <h3>New Subscription · {group.referenceName}</h3>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="modal-body">
          <div className="form-group">
            <label
              className="form-label"
              htmlFor="sub-name"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
            >
              <span>Display Name *</span>
              {app && (
                <PluginSlot
                  slot="text.edit"
                  ctx={{
                    slot: 'text.edit',
                    kind: 'subscriptionCreate.name',
                    text: name,
                    onChange: (v) => setName(v),
                    locale: 'en-US',
                    app,
                    meta: { groupName: group.referenceName, period },
                  }}
                />
              )}
            </label>
            <input
              id="sub-name"
              className="form-input"
              type="text"
              value={name}
              placeholder="Name shown to users"
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="sub-pid">
              Product ID * {!productIdDirty && <span className="form-hint" style={{ marginLeft: 6 }}>(auto)</span>}
            </label>
            <input
              id="sub-pid"
              className="form-input"
              type="text"
              value={productId}
              placeholder="e.g. com.app.weekly"
              onChange={(e) => { setProductIdDirty(true); setProductId(e.target.value); }}
              style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="sub-period">Billing Period *</label>
            <select
              id="sub-period"
              className="form-input"
              value={period}
              onChange={(e) => setPeriod(e.target.value as SubscriptionPeriod)}
            >
              {PERIOD_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label
              style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
            >
              <input
                type="checkbox"
                checked={familyShare}
                onChange={(e) => setFamilyShare(e.target.checked)}
              />
              <span>
                <span style={{ fontWeight: 600 }}>Family Sharing</span>
                <div className="form-hint">Allow members of a Family Sharing group to share this subscription.</div>
              </span>
            </label>
          </div>

          <div className="form-group">
            <label className="form-label">Group Level</label>
            <div className="form-input" style={{ background: 'var(--bg)', color: 'var(--text-secondary)' }}>
              {nextLevel} <span className="form-hint" style={{ marginLeft: 6 }}>(auto-assigned)</span>
            </div>
          </div>

          {error && (
            <div className="form-hint" style={{ color: 'var(--danger-text)' }}>{error}</div>
          )}
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

export const CreateSubscriptionModal = observer(CreateSubscriptionModalImpl);
