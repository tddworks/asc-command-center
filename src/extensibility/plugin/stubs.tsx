import type { HostUI } from './PluginAPI.ts';

/**
 * Placeholder host.ui — the real re-exports land with task #39. Using the
 * existing `.card` / `.modal` / `.btn` CSS classes so the stub already
 * looks consistent with the host.
 */

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
