import { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { accounts } from '../accountsInstance.ts';
import type { Account } from '../Account.ts';
import { useToast } from '../../../shared/components/Toast.tsx';
import { AccountSetupSheet } from './AccountSetupSheet.tsx';

interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * Accounts Manager — modal listing every stored asc account with switch /
 * edit-vendor-number / delete actions per row, plus an "Add account"
 * shortcut into `AccountSetupSheet`.
 *
 * Read-mode rows are tight; clicking Edit on a row swaps it for an inline
 * vendor-number editor with Cancel + Save. All mutations go through the
 * Account / Accounts domain — the sheet is purely a view.
 */
export const AccountsManagerSheet = observer(function AccountsManagerSheet({ open, onClose }: Props) {
  const [editingName, setEditingName] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [busyName, setBusyName] = useState<string | null>(null);
  const showToast = useToast();

  useEffect(() => {
    if (!open) return;
    setEditingName(null);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleSwitch = async (name: string) => {
    setBusyName(name);
    try {
      await accounts.switchTo(name);
      showToast(`Switched to ${name}`, 'success');
    } catch (err) {
      showToast(`Couldn't switch: ${(err as Error).message}`, 'error');
    } finally {
      setBusyName(null);
    }
  };

  const handleDelete = async (name: string) => {
    if (!confirm(`Remove account "${name}"? The credentials are deleted from the asc CLI.`)) return;
    setBusyName(name);
    try {
      await accounts.deleteAccount(name);
      showToast(`Removed ${name}`, 'success');
    } catch (err) {
      showToast(`Couldn't remove ${name}: ${(err as Error).message}`, 'error');
    } finally {
      setBusyName(null);
    }
  };

  const handleSave = async (account: Account) => {
    setBusyName(account.name);
    try {
      await account.save();
      setEditingName(null);
      showToast(`Saved ${account.name}`, 'success');
    } catch (err) {
      showToast(`Save failed: ${(err as Error).message}`, 'error');
    } finally {
      setBusyName(null);
    }
  };

  return (
    <>
      <div className="app-picker-backdrop" onClick={onClose}>
        <div
          className="app-picker-modal accounts-manager-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Manage asc accounts"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="auth-setup-titlebar">
            <div>
              <h3 className="auth-setup-title">Accounts</h3>
              <p className="auth-setup-subtitle">
                Stored locally by the asc CLI. Switch, edit, or remove credentials.
              </p>
            </div>
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

          <div className="accounts-manager-body">
            {accounts.accounts.length === 0 ? (
              <div className="accounts-manager-empty">
                No accounts saved yet. Add one to get started.
              </div>
            ) : (
              <ul className="accounts-manager-list">
                {accounts.accounts.map((a) => (
                  <AccountRow
                    key={a.name}
                    account={a}
                    editing={editingName === a.name}
                    busy={busyName === a.name}
                    onEdit={() => setEditingName(a.name)}
                    onCancel={() => { a.discard(); setEditingName(null); }}
                    onSave={() => handleSave(a)}
                    onSwitch={() => handleSwitch(a.name)}
                    onDelete={() => handleDelete(a.name)}
                  />
                ))}
              </ul>
            )}
          </div>

          <div className="accounts-manager-footer">
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setAddOpen(true)}>
              + Add account
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
              Done
            </button>
          </div>
        </div>
      </div>

      <AccountSetupSheet open={addOpen} onClose={() => setAddOpen(false)} />
    </>
  );
});

interface RowProps {
  account: Account;
  editing: boolean;
  busy: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  onSwitch: () => void;
  onDelete: () => void;
}

const AccountRow = observer(function AccountRow({
  account, editing, busy, onEdit, onCancel, onSave, onSwitch, onDelete,
}: RowProps) {
  return (
    <li className={`accounts-manager-row ${account.isActive ? 'is-active' : ''}`}>
      <div className="accounts-manager-row-head">
        <div className="accounts-manager-row-identity">
          <span className="accounts-manager-row-name">
            {account.displayName}
            {account.isActive && <span className="locale-manager-badge tone-primary" style={{ marginLeft: 8 }}>Active</span>}
          </span>
          <span className="accounts-manager-row-keyid">
            <code title={account.keyId}>{account.maskedKeyId}</code>
            <span className="accounts-manager-row-issuer" title={account.issuerId}>· {account.issuerId.slice(0, 8)}…</span>
          </span>
        </div>
        <div className="accounts-manager-row-actions">
          {!account.isActive && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={onSwitch} disabled={busy}>
              Switch
            </button>
          )}
          {!editing && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={onEdit} disabled={busy}>
              Edit
            </button>
          )}
          <button
            type="button"
            className="btn btn-danger btn-sm"
            onClick={onDelete}
            disabled={busy}
            title="Delete this account from the asc CLI"
          >
            Remove
          </button>
        </div>
      </div>

      {editing ? (
        <div className="accounts-manager-row-edit">
          <label className="form-label" htmlFor={`vn-${account.name}`}>Vendor number</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              id={`vn-${account.name}`}
              className="form-input"
              value={account.vendorNumber ?? ''}
              placeholder="92488713"
              onChange={(e) => account.setVendorNumber(e.target.value)}
              disabled={busy}
              autoFocus
            />
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={onCancel}
              disabled={busy}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={onSave}
              disabled={busy || !account.hasUnsavedChanges}
            >
              {busy ? 'Saving…' : 'Save'}
            </button>
          </div>
          <div className="form-hint">
            Used for sales / financial reports. Find it in App Store Connect → Payments and Financial Reports.
          </div>
        </div>
      ) : (
        account.vendorNumber && (
          <div className="accounts-manager-row-meta">
            Vendor # <code>{account.vendorNumber}</code>
          </div>
        )
      )}
    </li>
  );
});
