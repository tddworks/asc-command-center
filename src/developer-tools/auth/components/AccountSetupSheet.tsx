import { useEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { accounts } from '../accountsInstance.ts';
import { useToast } from '../../../shared/components/Toast.tsx';

interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * Setup sheet for first-time auth. Walks the user through the steps to
 * create a Team API Key in App Store Connect, then collects:
 *   • a local handle (defaults to "personal")
 *   • the Key ID and Issuer ID
 *   • the .p8 file (parsed to PEM in-browser; never re-uploaded)
 *
 * Sends a single POST to /api/v1/auth/accounts via the `accounts` aggregate.
 * On success the singleton refreshes, the sidebar widget flips to "signed
 * in", and the sheet closes itself.
 *
 * No staging, no in-sheet save bar — login is a single atomic action and
 * the page-level save semantics don't apply here.
 */
export const AccountSetupSheet = observer(function AccountSetupSheet({ open, onClose }: Props) {
  const [name, setName] = useState('personal');
  const [keyId, setKeyId] = useState('');
  const [issuerId, setIssuerId] = useState('');
  const [privateKeyPEM, setPrivateKeyPEM] = useState('');
  const [keyFileName, setKeyFileName] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const firstFieldRef = useRef<HTMLInputElement | null>(null);
  const showToast = useToast();

  useEffect(() => {
    if (!open) return;
    setError(null);
    requestAnimationFrame(() => firstFieldRef.current?.focus());

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose, submitting]);

  if (!open) return null;

  const canSubmit =
    !submitting &&
    name.trim().length > 0 &&
    keyId.trim().length > 0 &&
    issuerId.trim().length > 0 &&
    privateKeyPEM.trim().length > 0;

  const handleFile = async (file: File) => {
    setError(null);
    try {
      const text = await file.text();
      if (!/-----BEGIN PRIVATE KEY-----/.test(text)) {
        setError(`${file.name} doesn't look like a .p8 PEM file (missing BEGIN PRIVATE KEY header).`);
        return;
      }
      setPrivateKeyPEM(text);
      setKeyFileName(file.name);
    } catch (err) {
      setError(`Couldn't read ${file.name}: ${(err as Error).message}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await accounts.login({
        name: name.trim(),
        keyId: keyId.trim(),
        issuerId: issuerId.trim(),
        privateKeyPEM,
      });
      showToast(`Signed in as ${name.trim()}`, 'success');
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="app-picker-backdrop" onClick={() => { if (!submitting) onClose(); }}>
      <div
        className="app-picker-modal auth-setup-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Sign in to App Store Connect"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="auth-setup-titlebar">
          <div>
            <h3 className="auth-setup-title">Connect App Store Connect</h3>
            <p className="auth-setup-subtitle">Create a Team API Key, then paste its details below.</p>
          </div>
          <button
            type="button"
            className="app-picker-close"
            onClick={onClose}
            disabled={submitting}
            aria-label="Close"
          >
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M5 5l10 10M15 5L5 15"/>
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="auth-setup-body">
          <ol className="auth-setup-steps">
            <li>
              <strong>Open App Store Connect</strong> →{' '}
              <a href="https://appstoreconnect.apple.com/access/integrations/api" target="_blank" rel="noreferrer">
                Users and Access → Integrations → Team Keys
              </a>.
            </li>
            <li>Click <strong>Generate API Key</strong>, name it (e.g. "asc-cli"), and choose <strong>Admin</strong>.</li>
            <li>Download the <code>.p8</code> file once — Apple won't let you re-download it.</li>
            <li>Copy the <strong>Key ID</strong> and <strong>Issuer ID</strong> from the same page.</li>
          </ol>

          <div className="auth-setup-fields">
            <div className="form-group">
              <label className="form-label" htmlFor="auth-name">Local name</label>
              <input
                id="auth-name"
                ref={firstFieldRef}
                className="form-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="personal"
                disabled={submitting}
                autoComplete="off"
              />
              <div className="form-hint">A handle for switching between accounts later.</div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="auth-key-id">Key ID</label>
                <input
                  id="auth-key-id"
                  className="form-input"
                  value={keyId}
                  onChange={(e) => setKeyId(e.target.value)}
                  placeholder="ABCD123456"
                  disabled={submitting}
                  autoComplete="off"
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="auth-issuer-id">Issuer ID</label>
                <input
                  id="auth-issuer-id"
                  className="form-input"
                  value={issuerId}
                  onChange={(e) => setIssuerId(e.target.value)}
                  placeholder="69a6de7f-..."
                  disabled={submitting}
                  autoComplete="off"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Private key (.p8 file)</label>
              <div className="auth-setup-key-picker">
                <label className="btn btn-secondary btn-sm" style={{ cursor: submitting ? 'not-allowed' : 'pointer' }}>
                  Choose .p8 file
                  <input
                    type="file"
                    accept=".p8,application/x-pem-file,text/plain"
                    style={{ display: 'none' }}
                    disabled={submitting}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void handleFile(file);
                    }}
                  />
                </label>
                <span className="auth-setup-key-status">
                  {keyFileName
                    ? <><span className="auth-setup-key-ok" aria-hidden>✓</span> {keyFileName}</>
                    : <span style={{ color: 'var(--text-muted)' }}>No file selected.</span>}
                </span>
              </div>
              <div className="form-hint">
                Read in-browser and POSTed once to the local asc backend at <code>/api/v1/auth/accounts</code>. Never uploaded elsewhere.
              </div>
            </div>
          </div>

          {error && (
            <div className="auth-setup-error" role="alert">
              {error}
            </div>
          )}

          <div className="auth-setup-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={!canSubmit}>
              {submitting ? 'Signing in…' : 'Sign in'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
});
