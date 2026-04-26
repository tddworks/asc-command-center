import { useEffect, useRef, useState } from 'react';

interface Props {
  value: string;
  /** Async save handler — receives the trimmed new value. The component
   *  exits edit mode only after the save resolves. */
  onSave: (next: string) => Promise<void>;
  canEdit: boolean;
  /** Visual style of the displayed value. Default uses the page's `<h3>`. */
  className?: string;
  placeholder?: string;
}

/**
 * Inline rename control: renders the value as a heading with a pencil
 * button. Clicking the pencil swaps the heading for an input + check/cancel.
 * Used by detail-page headers to commit a single-field rename without
 * opening a modal.
 */
export function InlineRename({ value, onSave, canEdit, className, placeholder }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (editing) {
      setDraft(value);
      requestAnimationFrame(() => inputRef.current?.select());
    }
  }, [editing, value]);

  const cancel = () => {
    setEditing(false);
    setDraft(value);
    setError(null);
  };

  const commit = async () => {
    const trimmed = draft.trim();
    if (!trimmed || trimmed === value) {
      cancel();
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(trimmed);
      setEditing(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <h3 className={className} style={{ margin: 0 }}>{value}</h3>
        {canEdit && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setEditing(true)}
            title="Rename"
            aria-label="Rename"
            style={{ padding: '2px 8px' }}
          >
            ✎
          </button>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <input
        ref={inputRef}
        className="form-input"
        type="text"
        value={draft}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void commit();
          if (e.key === 'Escape') cancel();
        }}
        disabled={saving}
        style={{ minWidth: 240 }}
      />
      <button
        type="button"
        className="btn btn-primary btn-sm"
        onClick={commit}
        disabled={saving || !draft.trim()}
        title="Save"
      >
        {saving ? '…' : '✓'}
      </button>
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        onClick={cancel}
        disabled={saving}
        title="Cancel"
      >
        ✕
      </button>
      {error && (
        <span className="form-hint" style={{ color: 'var(--danger-text)', marginLeft: 6 }}>{error}</span>
      )}
    </div>
  );
}
