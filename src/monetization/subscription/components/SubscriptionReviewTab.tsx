import { useEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import type { Subscription } from '../Subscription.ts';

interface Props {
  sub: Subscription;
}

function SubscriptionReviewTabImpl({ sub }: Props) {
  const [note, setNote] = useState(sub.reviewNote ?? '');
  const [savingNote, setSavingNote] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);

  const [uploading, setUploading] = useState(false);
  const [shotError, setShotError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setNote(sub.reviewNote ?? '');
  }, [sub.reviewNote]);

  useEffect(() => {
    if (sub.isReviewScreenshotLoaded) return;
    void sub.loadReviewScreenshot().catch((err) => {
      console.warn('[subscription] loadReviewScreenshot failed:', err);
    });
  }, [sub]);

  const noteDirty = (sub.reviewNote ?? '') !== note;
  const canSaveNote = noteDirty && !savingNote && sub.canUpdate;

  const saveNote = async () => {
    setSavingNote(true);
    setNoteError(null);
    try {
      await sub.updateReviewNote(note.length === 0 ? null : note);
    } catch (err) {
      setNoteError((err as Error).message);
    } finally {
      setSavingNote(false);
    }
  };

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setShotError(null);
    try { await sub.uploadReviewScreenshot(file); }
    catch (err) { setShotError((err as Error).message); }
    finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeShot = async () => {
    if (!sub.reviewScreenshot) return;
    if (!window.confirm('Remove this screenshot?')) return;
    setShotError(null);
    try { await sub.deleteReviewScreenshot(); }
    catch (err) { setShotError((err as Error).message); }
  };

  return (
    <div>
      {/* Review screenshot */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="toolbar">
          <div className="toolbar-left"><strong>Review Screenshot</strong></div>
          <div className="toolbar-right" style={{ display: 'flex', gap: 6 }}>
            {sub.canUploadReviewScreenshot && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={onPickFile}
                />
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? 'Uploading…' : sub.reviewScreenshot ? 'Replace' : 'Upload'}
                </button>
              </>
            )}
            {sub.reviewScreenshot?.canDelete && (
              <button type="button" className="btn btn-secondary btn-sm" onClick={removeShot} disabled={uploading}>
                Remove
              </button>
            )}
          </div>
        </div>
        <div className="card-body">
          {!sub.canViewReviewScreenshot ? (
            <span className="muted">Backend does not expose review screenshots for this tier.</span>
          ) : !sub.isReviewScreenshotLoaded ? (
            <div className="loading"><span className="spinner" /><span>Loading screenshot…</span></div>
          ) : sub.reviewScreenshot ? (
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              {sub.reviewScreenshot.previewUrl ? (
                <img
                  src={sub.reviewScreenshot.previewUrl}
                  alt="Review screenshot"
                  style={{ maxWidth: 240, maxHeight: 320, border: '1px solid var(--border)', borderRadius: 6 }}
                />
              ) : (
                <div className="muted">No preview available.</div>
              )}
              <div className="cell-mono" style={{ alignSelf: 'center' }}>
                {sub.reviewScreenshot.fileName}
              </div>
            </div>
          ) : (
            <div
              style={{
                padding: 24, textAlign: 'center',
                border: '2px dashed var(--border)', borderRadius: 8,
              }}
            >
              <div style={{ opacity: 0.5, fontSize: 28 }}>📷</div>
              <div className="muted" style={{ marginTop: 4 }}>
                No screenshot uploaded. Click <strong>Upload</strong> above to add one.
              </div>
            </div>
          )}
          {shotError && (
            <div className="form-hint" style={{ color: 'var(--danger-text)', marginTop: 8 }}>
              {shotError}
            </div>
          )}
        </div>
      </div>

      {/* Review notes */}
      <div className="card">
        <div className="toolbar">
          <div className="toolbar-left"><strong>Review Notes</strong></div>
          <div className="toolbar-right" style={{ display: 'flex', gap: 6 }}>
            {noteDirty && !savingNote && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setNote(sub.reviewNote ?? '')}
              >
                Discard
              </button>
            )}
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={saveNote}
              disabled={!canSaveNote}
            >
              {savingNote ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
        <div className="card-body">
          <textarea
            className="form-input"
            rows={5}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Explain how to test this subscription for the App Review team."
          />
          {noteError && (
            <div className="form-hint" style={{ color: 'var(--danger-text)', marginTop: 8 }}>
              {noteError}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export const SubscriptionReviewTab = observer(SubscriptionReviewTabImpl);
