import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { accounts } from '../accountsInstance.ts';
import { AccountSetupSheet } from './AccountSetupSheet.tsx';

/**
 * Sidebar footer auth widget. Replaces the static "asc auth check"
 * placeholder. Reads from the `accounts` singleton; renders one of four
 * states (loading / signed-in / not-signed-in / failed) with a clear
 * top-line label plus a one-line action row underneath.
 */
export const AuthStatus = observer(function AuthStatus() {
  const [setupOpen, setSetupOpen] = useState(false);

  if (!accounts.loaded || (accounts.isLoading && !accounts.loaded)) {
    return (
      <div className="auth-card">
        <div className="auth-card-row">
          <span className="auth-dot tone-neutral" aria-hidden />
          <span className="auth-card-label">Checking…</span>
        </div>
      </div>
    );
  }

  if (accounts.error) {
    return (
      <div className="auth-card is-error">
        <div className="auth-card-row">
          <span className="auth-dot tone-danger" aria-hidden />
          <span className="auth-card-label">Connection failed</span>
        </div>
        <button
          type="button"
          className="auth-card-action"
          onClick={() => { void accounts.refresh(); }}
        >
          Retry
        </button>
      </div>
    );
  }

  if (accounts.isAuthenticated && accounts.active) {
    const a = accounts.active;
    return (
      <div className="auth-card is-signed-in">
        <div className="auth-card-row">
          <span className="auth-dot tone-success" aria-hidden />
          <span className="auth-card-label">{a.displayName}</span>
        </div>
        <div className="auth-card-meta">
          <code title={a.keyId}>{a.maskedKeyId}</code>
          <button
            type="button"
            className="auth-card-link"
            onClick={() => { void accounts.logout(); }}
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="auth-card is-cta">
        <div className="auth-card-row">
          <span className="auth-dot tone-warning" aria-hidden />
          <span className="auth-card-label">Not signed in</span>
        </div>
        <button
          type="button"
          className="auth-card-action auth-card-action-primary"
          onClick={() => setSetupOpen(true)}
        >
          Set up account
        </button>
      </div>
      <AccountSetupSheet open={setupOpen} onClose={() => setSetupOpen(false)} />
    </>
  );
});
