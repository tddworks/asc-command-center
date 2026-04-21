import { observer } from 'mobx-react-lite';
import type { AppInfoLocalization } from '../AppInfoLocalization.ts';

interface Props {
  localization: AppInfoLocalization;
  isPrimary: boolean;
  expanded: boolean;
  onToggle: () => void;
  onRemove?: () => void;
}

function LocaleRow({ localization, isPrimary, expanded, onToggle, onRemove }: Props) {
  return (
    <div className={`locale-row ${expanded ? 'is-expanded' : ''}`}>
      <button type="button" className="locale-row-header" onClick={onToggle}>
        <svg className="locale-row-chev" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <polyline points="5 6 8 10 11 6"/>
        </svg>
        <span className="platform-badge">{localization.locale}</span>
        <span className="locale-row-name">{localization.name || '—'}</span>
        <span className="locale-row-subtitle">{localization.subtitle ?? ''}</span>
        {isPrimary && <span className="locale-row-primary-tag">primary</span>}
        {localization.hasUnsavedChanges && <span className="locale-row-dirty" aria-label="Unsaved changes"/>}
      </button>

      {expanded && (
        <div className="locale-row-body">
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Name</label>
              <input
                className="form-control"
                value={localization.name}
                onChange={(e) => localization.setName(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Subtitle</label>
              <input
                className="form-control"
                value={localization.subtitle ?? ''}
                onChange={(e) => localization.setSubtitle(e.target.value || null)}
              />
            </div>
          </div>
          {!isPrimary && onRemove && (
            <div className="locale-row-actions">
              <button type="button" className="btn btn-danger btn-sm" onClick={onRemove}>
                Remove locale
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default observer(LocaleRow);
