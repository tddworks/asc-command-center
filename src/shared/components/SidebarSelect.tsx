import { useEffect, useRef, useState, type ReactNode } from 'react';

export interface SidebarSelectOption {
  id: string;
  primary: ReactNode;      // main label line (bold)
  secondary?: ReactNode;   // supporting line (muted)
  leading?: ReactNode;     // icon/avatar/glyph on the left
  trailing?: ReactNode;    // right-side badge/dot
  searchText?: string;     // optional text used by the filter
}

interface Props {
  label: string;                        // section header above the button
  options: SidebarSelectOption[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  placeholder?: string;
  filterable?: boolean;
  emptyText?: string;
}

/**
 * Styled dropdown for the sidebar. Shows a card-like button (icon + primary +
 * secondary + chevron); click opens a popover with a filter and a list of
 * rows. Closes on outside click, Escape, or Enter.
 *
 * No new deps — plain DOM + React.
 */
export function SidebarSelect({
  label, options, selectedId, onSelect,
  placeholder = 'Select…',
  filterable = true,
  emptyText = 'No options',
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const selected = options.find((o) => o.id === selectedId) ?? null;

  const filtered = query
    ? options.filter((o) =>
        (o.searchText ?? `${o.primary} ${o.secondary ?? ''}`)
          .toString()
          .toLowerCase()
          .includes(query.toLowerCase()),
      )
    : options;

  useEffect(() => {
    if (!open) return;

    const onDown = (e: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIdx(Math.max(0, filtered.findIndex((o) => o.id === selectedId)));
      // Focus filter after the popover lands in the DOM
      requestAnimationFrame(() => inputRef.current?.focus());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const commit = (id: string) => {
    onSelect(id);
    setOpen(false);
  };

  const onListKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(filtered.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = filtered[activeIdx];
      if (target) commit(target.id);
    }
  };

  return (
    <div className="sidebar-select-root" ref={rootRef}>
      <div className="nav-section-title">{label}</div>
      <button
        type="button"
        className={`sidebar-select-button ${open ? 'is-open' : ''}`}
        onClick={() => setOpen((v) => !v)}
      >
        {selected ? (
          <>
            {selected.leading && <span className="ss-leading">{selected.leading}</span>}
            <span className="ss-labels">
              <span className="ss-primary">{selected.primary}</span>
              {selected.secondary && <span className="ss-secondary">{selected.secondary}</span>}
            </span>
            {selected.trailing && <span className="ss-trailing">{selected.trailing}</span>}
          </>
        ) : (
          <span className="ss-primary ss-placeholder">{placeholder}</span>
        )}
        <svg className="ss-chevron" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 8 10 12 14 8"/></svg>
      </button>

      {open && (
        <div className="sidebar-select-popover" role="listbox">
          {filterable && options.length > 4 && (
            <input
              ref={inputRef}
              type="text"
              className="sidebar-select-filter"
              placeholder="Filter…"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setActiveIdx(0); }}
              onKeyDown={onListKey}
            />
          )}
          <div className="sidebar-select-list">
            {filtered.length === 0 && (
              <div className="sidebar-select-empty">{emptyText}</div>
            )}
            {filtered.map((opt, i) => (
              <button
                key={opt.id}
                type="button"
                className={`sidebar-select-row ${opt.id === selectedId ? 'is-selected' : ''} ${i === activeIdx ? 'is-active' : ''}`}
                onClick={() => commit(opt.id)}
                onMouseEnter={() => setActiveIdx(i)}
              >
                {opt.leading && <span className="ss-leading">{opt.leading}</span>}
                <span className="ss-labels">
                  <span className="ss-primary">{opt.primary}</span>
                  {opt.secondary && <span className="ss-secondary">{opt.secondary}</span>}
                </span>
                {opt.trailing && <span className="ss-trailing">{opt.trailing}</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
