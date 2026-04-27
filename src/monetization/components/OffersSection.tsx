import type { ReactNode } from 'react';

interface Props {
  title: string;
  /** Subtitle next to the title — usually the row count or "x active". */
  subtitle?: ReactNode;
  /** Right-aligned slot for the section's primary action (CTA button, etc.). */
  actions?: ReactNode;
  /** Renders the not-supported message when false. Skips the empty/loading
   *  branches entirely. */
  isSupported: boolean;
  /** Toggles the loading spinner branch. */
  isLoaded: boolean;
  /** Toggles the empty-state branch. */
  isEmpty: boolean;
  /** Copy shown when `!isSupported`. */
  notSupportedMessage: string;
  /** Copy shown when loaded + empty. */
  emptyMessage: string;
  /** Optional decoration shown in the empty state (emoji, etc.). */
  emptyDecoration?: ReactNode;
  /** Body shown when supported, loaded, and non-empty. */
  children: ReactNode;
  /** marginBottom applied to the wrapping `.card`. Defaults to 12. */
  marginBottom?: number;
}

/**
 * Shared "offers section" card — used by both IAP and Subscription offers
 * tabs. Renders a toolbar header (title + count + action) and one of four
 * body branches: not-supported / loading / empty / list.
 */
export function OffersSection({
  title,
  subtitle,
  actions,
  isSupported,
  isLoaded,
  isEmpty,
  notSupportedMessage,
  emptyMessage,
  emptyDecoration,
  children,
  marginBottom = 12,
}: Props) {
  return (
    <div className="card" style={{ marginBottom }}>
      <div className="toolbar">
        <div className="toolbar-left">
          <strong>{title}</strong>
          {subtitle !== undefined && (
            <span className="muted" style={{ marginLeft: 8 }}>{subtitle}</span>
          )}
        </div>
        {actions && <div className="toolbar-right">{actions}</div>}
      </div>
      {!isSupported ? (
        <div className="card-body"><span className="muted">{notSupportedMessage}</span></div>
      ) : !isLoaded ? (
        <div className="card-body"><div className="loading"><span className="spinner" /><span>Loading…</span></div></div>
      ) : isEmpty ? (
        <div className="card-body" style={{ textAlign: 'center', padding: 24 }}>
          {emptyDecoration}
          <p className="muted" style={{ marginTop: emptyDecoration ? 8 : 0 }}>{emptyMessage}</p>
        </div>
      ) : (
        children
      )}
    </div>
  );
}
