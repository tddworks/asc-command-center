import { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { subscriptionGroups } from '../subscriptionGroupsInstance.ts';
import { workspace } from '../../../workspace/workspaceInstance.ts';
import { PluginSlot } from '../../../extensibility/plugin/PluginSlot.tsx';

interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * Create a new SubscriptionGroup. Mirrors the iOS prototype's "New Group"
 * sheet — a single Reference Name input, no Product ID (groups don't have
 * one). Display names per locale are added later via group localizations.
 */
function CreateSubscriptionGroupModalImpl({ open, onClose }: Props) {
  const app = workspace.currentApp;

  const [referenceName, setReferenceName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setReferenceName('');
    setError(null);
    setSubmitting(false);
  }, [open]);

  if (!open) return null;

  const trimmed = referenceName.trim();
  const canSubmit = !!trimmed && !!app && !submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !app) return;
    setSubmitting(true);
    setError(null);
    try {
      await subscriptionGroups.create({ appId: app.id, referenceName: trimmed });
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
          <h3>New Subscription Group</h3>
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
            <label
              className="form-label"
              htmlFor="grp-ref"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
            >
              <span>Reference Name *</span>
              {app && (
                <PluginSlot
                  slot="text.edit"
                  ctx={{
                    slot: 'text.edit',
                    kind: 'subscriptionGroupCreate.referenceName',
                    text: referenceName,
                    onChange: (v) => setReferenceName(v),
                    locale: 'en-US',
                    app,
                  }}
                />
              )}
            </label>
            <input
              id="grp-ref"
              className="form-input"
              type="text"
              value={referenceName}
              placeholder="Internal group name"
              onChange={(e) => setReferenceName(e.target.value)}
              autoFocus
            />
          </div>

          {error && (
            <div className="form-hint" style={{ color: 'var(--danger-text)' }}>{error}</div>
          )}

          <div className="form-hint">
            Users can only subscribe to one tier within a group at a time.
            Display names per locale are added after creation.
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

export const CreateSubscriptionGroupModal = observer(CreateSubscriptionGroupModalImpl);
