import type { HostUI } from './PluginAPI.ts';

/**
 * `host.ui` — the host's design-system primitives re-exported for plugin
 * use. Wraps the existing `.card` / `.modal` / `.form-group` / `.btn`
 * CSS classes so a plugin that uses these components inherits the app's
 * look-and-feel automatically and can't drift visually.
 *
 * `tokens` exposes the canonical CSS custom-property *names* plugin code
 * references (e.g. `var(host.ui.tokens.accent)` stays tied to the host's
 * palette even when the user toggles theme). Values resolve at render
 * time via `var(--…)` — no need to snapshot colours here.
 */

/** Canonical token names. Values match `src/styles/theme.css`; additions
 *  here are additive to plugins and do not require an API version bump. */
export const HOST_TOKENS: Readonly<Record<string, string>> = Object.freeze({
  bg:            '--bg',
  bgCard:        '--bg-card',
  bgSidebar:     '--bg-sidebar',
  bgHover:       '--bg-hover',
  bgActive:      '--bg-active',
  border:        '--border',
  borderLight:   '--border-light',
  textPrimary:   '--text-primary',
  textSecondary: '--text-secondary',
  textMuted:     '--text-muted',
  accent:        '--accent',
  accentHover:   '--accent-hover',
  accentLight:   '--accent-light',
  success:       '--success',
  warning:       '--warning',
  danger:        '--danger',
  info:          '--info',
  radiusSm:      '--radius-sm',
  radius:        '--radius',
  radiusLg:      '--radius-lg',
  radiusXl:      '--radius-xl',
  shadowSm:      '--shadow-sm',
  shadow:        '--shadow',
  shadowMd:      '--shadow-md',
  shadowLg:      '--shadow-lg',
  transition:    '--transition',
});

export const hostUI: HostUI = {
  tokens: HOST_TOKENS,
  components: {
    Card: ({ children, className }) => (
      <div className={`card ${className ?? ''}`}>{children}</div>
    ),

    Modal: ({ open, onClose, title, children }) => {
      if (!open) return null;
      return (
        <div className="modal-overlay open" role="dialog" aria-modal="true">
          <div className="modal">
            {title && (
              <div className="modal-header">
                <h3>{title}</h3>
                <button type="button" className="modal-close" aria-label="Close" onClick={onClose}>✕</button>
              </div>
            )}
            <div className="modal-body">{children}</div>
          </div>
        </div>
      );
    },

    FormGroup: ({ label, hint, htmlFor, children }) => (
      <div className="form-group">
        <label className="form-label" htmlFor={htmlFor}>{label}</label>
        {children}
        {hint && <div className="form-hint">{hint}</div>}
      </div>
    ),

    Button: ({ tone = 'secondary', size = 'md', className, children, ...rest }) => {
      const classes = [
        'btn',
        tone === 'primary' ? 'btn-primary'
          : tone === 'danger' ? 'btn-danger'
          : 'btn-secondary',
        size === 'sm' ? 'btn-sm' : '',
        className ?? '',
      ].filter(Boolean).join(' ');
      return <button className={classes} {...rest}>{children}</button>;
    },
  },
};
