import { useEffect, useState } from 'react';
import { useRecheckMode } from '../../../shared/api-client.tsx';
import { useToast } from '../../../shared/components/Toast.tsx';
import { accounts } from '../accountsInstance.ts';

interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * Setup sheet shown when the asc backend isn't reachable.
 *
 * Walks the first-time visitor through:
 *   1. Install asc CLI (Homebrew, with link to the open-source repo).
 *   2. Start the local web-server.
 *   3. Try again — re-probes /api/v1 and refreshes auth state.
 *
 * The "open source" framing matters: the user is being asked to install a
 * binary that handles their App Store Connect API keys. Linking the GitHub
 * repo and showing the formula source builds trust before they paste any
 * credentials.
 */
export function CliSetupSheet({ open, onClose }: Props) {
  const recheck = useRecheckMode();
  const showToast = useToast();
  const [trying, setTrying] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTrying(false);
    setCopiedCmd(null);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !trying) onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose, trying]);

  if (!open) return null;

  const copy = async (cmd: string) => {
    try {
      await navigator.clipboard.writeText(cmd);
      setCopiedCmd(cmd);
      setTimeout(() => setCopiedCmd((c) => (c === cmd ? null : c)), 1500);
    } catch {
      // Clipboard blocked — silently no-op; the user can still select+copy.
    }
  };

  const handleTryAgain = async () => {
    setTrying(true);
    try {
      const ok = await recheck();
      if (ok) {
        await accounts.refresh();
        showToast('asc backend connected', 'success');
        onClose();
      } else {
        showToast("Still can't reach asc — make sure web-server is running on port 8420", 'error');
      }
    } finally {
      setTrying(false);
    }
  };

  return (
    <div className="app-picker-backdrop" onClick={() => { if (!trying) onClose(); }}>
      <div
        className="app-picker-modal cli-setup-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Connect the asc CLI"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="auth-setup-titlebar">
          <div>
            <h3 className="auth-setup-title">Connect asc CLI</h3>
            <p className="auth-setup-subtitle">
              This UI talks to a local asc backend.{' '}
              <a href="https://github.com/tddworks/asc-cli" target="_blank" rel="noreferrer">
                asc is open source
              </a>
              {' '}— install it once, then start the web server.
            </p>
          </div>
          <button
            type="button"
            className="app-picker-close"
            onClick={onClose}
            disabled={trying}
            aria-label="Close"
          >
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M5 5l10 10M15 5L5 15"/>
            </svg>
          </button>
        </div>

        <div className="cli-setup-body">
          <Step
            n={1}
            title="Install asc"
            hint="One-time. Homebrew, from the tddworks tap."
            command="brew install tddworks/tap/asccli"
            onCopy={copy}
            copied={copiedCmd === 'brew install tddworks/tap/asccli'}
          />
          <Step
            n={2}
            title="Start the web server"
            hint="Binds to localhost:8420 by default. Leave it running while you use this UI."
            command="asc web-server"
            onCopy={copy}
            copied={copiedCmd === 'asc web-server'}
          />
          <Step
            n={3}
            title="Come back here"
            hint="Once asc is running, click Try again. We'll re-probe /api/v1 and pick up your stored accounts."
            command={null}
            onCopy={copy}
            copied={false}
          />
        </div>

        <div className="cli-setup-footer">
          <a
            className="cli-setup-link"
            href="https://github.com/tddworks/asc-cli"
            target="_blank"
            rel="noreferrer"
          >
            View source on GitHub →
          </a>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={trying}>
              Close
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleTryAgain}
              disabled={trying}
            >
              {trying ? 'Probing…' : 'Try again'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Step({
  n, title, hint, command, onCopy, copied,
}: {
  n: number;
  title: string;
  hint: string;
  command: string | null;
  onCopy: (cmd: string) => void;
  copied: boolean;
}) {
  return (
    <div className="cli-setup-step">
      <div className="cli-setup-step-number" aria-hidden>{n}</div>
      <div className="cli-setup-step-body">
        <div className="cli-setup-step-title">{title}</div>
        <div className="cli-setup-step-hint">{hint}</div>
        {command && (
          <div className="cli-setup-cmd">
            <code>{command}</code>
            <button
              type="button"
              className="cli-setup-cmd-copy"
              onClick={() => onCopy(command)}
              aria-label={`Copy: ${command}`}
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
