import type { PluginSettings, HostUI } from './PluginAPI.ts';

/**
 * Placeholder implementations used until their real versions land:
 *   • settings — task #37 wires REST + keychain via asc-cli.
 *   • ui       — task #39 re-exports the host design-system components.
 *
 * These stubs keep `installPluginAPI` compilable and runnable without
 * blocking plugin registration work. A plugin that calls a stubbed
 * feature gets a clear console warning.
 */

export const stubSettings: PluginSettings = {
  async load() {
    console.warn('[pluginAPI.settings] not wired yet — returning {}');
    return {} as never;
  },
  async save() {
    console.warn('[pluginAPI.settings] not wired yet — no-op save');
  },
  subscribe() {
    return () => {};
  },
};

export const stubUI: HostUI = {
  tokens: {},
  components: {
    Card: ({ children, className }) => (
      // Uses the existing `.card` CSS so the stub already looks right.
      <div className={`card ${className ?? ''}`}>{children}</div>
    ),
    Modal: ({ open, onClose, title, children }) => open ? (
      <div className="modal-overlay open" role="dialog" aria-modal="true">
        <div className="modal">
          {title && (
            <div className="modal-header">
              <h3>{title}</h3>
              <button type="button" className="modal-close" onClick={onClose}>✕</button>
            </div>
          )}
          <div className="modal-body">{children}</div>
        </div>
      </div>
    ) : null,
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
