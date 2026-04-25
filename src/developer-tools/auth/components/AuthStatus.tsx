import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { accounts } from '../accountsInstance.ts';
import { AccountSetupSheet } from './AccountSetupSheet.tsx';

/**
 * Sidebar footer auth widget. Replaces the static "asc auth check"
 * placeholder. Reads from the `accounts` singleton; renders one of four
 * states (loading / signed-in / not-signed-in / failed) and wires the
 * setup sheet for the unauthenticated path.
 */
export const AuthStatus = observer(function AuthStatus() {
  const [setupOpen, setSetupOpen] = useState(false);

  const tone = accounts.statusTone;
  const label = accounts.statusLabel;

  return (
    <div className="auth-status">
      <div className={`auth-dot tone-${tone}`} aria-hidden />
      <div className="auth-info">
        <span className="auth-info-primary">{label}</span>
        <AuthAction
          accountsLoaded={accounts.loaded}
          isAuthenticated={accounts.isAuthenticated}
          isLoading={accounts.isLoading}
          hasError={accounts.error !== null}
          activeName={accounts.active?.name}
          activeKeyId={accounts.active?.maskedKeyId}
          onSetup={() => setSetupOpen(true)}
          onRetry={() => { void accounts.refresh(); }}
          onLogout={() => { void accounts.logout(); }}
        />
      </div>

      <AccountSetupSheet open={setupOpen} onClose={() => setSetupOpen(false)} />
    </div>
  );
});

interface AuthActionProps {
  accountsLoaded: boolean;
  isAuthenticated: boolean;
  isLoading: boolean;
  hasError: boolean;
  activeName: string | undefined;
  activeKeyId: string | undefined;
  onSetup: () => void;
  onRetry: () => void;
  onLogout: () => void;
}

function AuthAction({
  accountsLoaded, isAuthenticated, isLoading, hasError, activeKeyId, onSetup, onRetry, onLogout,
}: AuthActionProps) {
  if (!accountsLoaded || isLoading) {
    return <span className="auth-info-secondary">asc auth check</span>;
  }
  if (hasError) {
    return (
      <button type="button" className="auth-info-link" onClick={onRetry}>
        Retry
      </button>
    );
  }
  if (isAuthenticated) {
    return (
      <span className="auth-info-secondary">
        <span className="auth-info-keyid">{activeKeyId}</span>
        <button type="button" className="auth-info-link" onClick={onLogout}>
          Sign out
        </button>
      </span>
    );
  }
  return (
    <button type="button" className="auth-info-link auth-info-cta" onClick={onSetup}>
      Set up
    </button>
  );
}
