import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { accounts } from '../accountsInstance.ts';
import { AccountSetupSheet } from './AccountSetupSheet.tsx';
import { AccountsManagerSheet } from './AccountsManagerSheet.tsx';
import { CliSetupSheet } from './CliSetupSheet.tsx';
import { useDataMode } from '../../../shared/api-client.tsx';

/**
 * Sidebar footer auth widget. Mirrors the rest of the sidebar's quiet
 * typography — small caps section header on top, single line state
 * underneath, no loud cards. Three exclusive cases:
 *
 *   1. asc backend not reachable (`mode === 'mock'`) → "asc CLI not running"
 *      with a "Set up" link that opens `CliSetupSheet` (install + start
 *      guide). This is what a first-time visitor sees.
 *   2. Backend reachable but no active account → "Not signed in" with a
 *      "Set up account" link that opens `AccountSetupSheet` (paste API key).
 *   3. Active account → name + masked key id + "Sign out".
 *
 * The two setup paths are different problems with different fixes —
 * conflating them was the root cause of the original "Not signed in"
 * message confusing users who didn't have asc installed at all.
 */
export const AuthStatus = observer(function AuthStatus() {
  const mode = useDataMode();
  const [accountSetupOpen, setAccountSetupOpen] = useState(false);
  const [cliSetupOpen, setCliSetupOpen] = useState(false);
  const [managerOpen, setManagerOpen] = useState(false);

  // Backend not reachable — install/start guide is the right answer here,
  // not the account setup form.
  if (mode === 'mock') {
    return (
      <>
        <div className="sidebar-auth">
          <div className="sidebar-auth-row">
            <span className="auth-dot tone-warning" aria-hidden />
            <span className="sidebar-auth-name">asc CLI not running</span>
          </div>
          <button
            type="button"
            className="sidebar-auth-link"
            onClick={() => setCliSetupOpen(true)}
          >
            Set up
          </button>
        </div>
        <CliSetupSheet open={cliSetupOpen} onClose={() => setCliSetupOpen(false)} />
      </>
    );
  }

  if (!accounts.loaded) {
    return (
      <div className="sidebar-auth">
        <div className="sidebar-auth-row">
          <span className="auth-dot tone-neutral" aria-hidden />
          <span className="sidebar-auth-name">Checking…</span>
        </div>
      </div>
    );
  }

  if (accounts.error) {
    return (
      <div className="sidebar-auth">
        <div className="sidebar-auth-row">
          <span className="auth-dot tone-danger" aria-hidden />
          <span className="sidebar-auth-name">Connection failed</span>
        </div>
        <button
          type="button"
          className="sidebar-auth-link"
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
      <>
        <div className="sidebar-auth">
          <button
            type="button"
            className="sidebar-auth-row sidebar-auth-row-button"
            onClick={() => setManagerOpen(true)}
            title="Manage accounts"
          >
            <span className="auth-dot tone-success" aria-hidden />
            <span className="sidebar-auth-name">{a.displayName}</span>
            <svg
              className="sidebar-auth-chevron"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <polyline points="5 6 8 9 11 6"/>
            </svg>
          </button>
          <div className="sidebar-auth-meta">
            <code title={a.keyId}>{a.maskedKeyId}</code>
            <button
              type="button"
              className="sidebar-auth-link"
              onClick={() => { void accounts.logout(); }}
            >
              Sign out
            </button>
          </div>
        </div>
        <AccountsManagerSheet open={managerOpen} onClose={() => setManagerOpen(false)} />
      </>
    );
  }

  // Backend reachable, no account stored.
  return (
    <>
      <div className="sidebar-auth">
        <div className="sidebar-auth-row">
          <span className="auth-dot tone-warning" aria-hidden />
          <span className="sidebar-auth-name">Not signed in</span>
        </div>
        <button
          type="button"
          className="sidebar-auth-link"
          onClick={() => setAccountSetupOpen(true)}
        >
          Set up account
        </button>
      </div>
      <AccountSetupSheet open={accountSetupOpen} onClose={() => setAccountSetupOpen(false)} />
    </>
  );
});
