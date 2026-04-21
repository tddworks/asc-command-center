import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import type { AppInfo } from '../AppInfo.ts';
import LocaleRow from './LocaleRow.tsx';

interface Props {
  appInfo: AppInfo;
}

function LocalizationsTable({ appInfo }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [addInput, setAddInput] = useState('');
  const [addOpen, setAddOpen] = useState(false);

  const handleAdd = () => {
    const locale = addInput.trim();
    if (!locale) return;
    try {
      const loc = appInfo.addLocalization(locale);
      setAddInput('');
      setAddOpen(false);
      setExpanded(loc.locale);
    } catch (err) {
      alert((err as Error).message);
    }
  };

  return (
    <div className="localizations-table">
      {appInfo.localizations.map((loc) => (
        <LocaleRow
          key={loc.locale}
          localization={loc}
          isPrimary={loc.locale === appInfo.primaryLocale}
          expanded={expanded === loc.locale}
          onToggle={() => setExpanded(expanded === loc.locale ? null : loc.locale)}
          onRemove={
            loc.locale !== appInfo.primaryLocale
              ? () => {
                  appInfo.removeLocalization(loc.locale);
                  if (expanded === loc.locale) setExpanded(null);
                }
              : undefined
          }
        />
      ))}

      {addOpen ? (
        <div className="locale-row-add">
          <input
            className="form-control"
            placeholder="Locale (e.g. fr-FR)"
            value={addInput}
            onChange={(e) => setAddInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAdd();
              else if (e.key === 'Escape') { setAddOpen(false); setAddInput(''); }
            }}
            autoFocus
          />
          <button type="button" className="btn btn-primary btn-sm" onClick={handleAdd}>Add</button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setAddOpen(false); setAddInput(''); }}>Cancel</button>
        </div>
      ) : (
        <button type="button" className="locale-row-add-trigger" onClick={() => setAddOpen(true)}>
          + Add locale
        </button>
      )}
    </div>
  );
}

export default observer(LocalizationsTable);
