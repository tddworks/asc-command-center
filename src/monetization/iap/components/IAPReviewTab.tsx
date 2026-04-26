import { useEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import type { InAppPurchase } from '../InAppPurchase.ts';

interface Props {
  iap: InAppPurchase;
}

function IAPReviewTabImpl({ iap }: Props) {
  const [note, setNote] = useState(iap.reviewNote ?? '');
  const [savingNote, setSavingNote] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);

  const [uploading, setUploading] = useState(false);
  const [shotError, setShotError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setNote(iap.reviewNote ?? '');
  }, [iap.reviewNote]);

  useEffect(() => {
    if (iap.isReviewScreenshotLoaded) return;
    void iap.loadReviewScreenshot().catch((err) => {
      console.warn('[iap] loadReviewScreenshot failed:', err);
    });
  }, [iap]);

  const noteDirty = (iap.reviewNote ?? '') !== note;
  const canSaveNote = noteDirty && !savingNote && 'update' in iap.affordances;

  const saveNote = async () => {
    setSavingNote(true);
    setNoteError(null);
    try {
      await iap.updateReviewNote(note.length === 0 ? null : note);
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
    try {
      await iap.uploadReviewScreenshot(file);
    } catch (err) {
      setShotError((err as Error).message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeShot = async () => {
    if (!iap.reviewScreenshot) return;
    if (!window.confirm('Remove this screenshot?')) return;
    setShotError(null);
    try {
      await iap.deleteReviewScreenshot();
    } catch (err) {
      setShotError((err as Error).message);
    }
  };

  const triggerUpload = () => fileInputRef.current?.click();
  const screenshot = iap.reviewScreenshot;

  return (
    <div>
      {/* Review screenshot */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="toolbar">
          <div className="toolbar-left">
            <h3>Review Screenshot</h3>
            <span className="muted" style={{ marginLeft: 8 }}>
              {screenshot ? screenshot.fileName : 'Optional · helps reviewers verify the IAP'}
            </span>
          </div>
          <div className="toolbar-right" style={{ display: 'flex', gap: 6 }}>
            {iap.canUploadReviewScreenshot && (
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
                  onClick={triggerUpload}
                  disabled={uploading}
                >
                  {uploading ? 'Uploading…' : screenshot ? 'Replace' : 'Upload'}
                </button>
              </>
            )}
            {screenshot?.canDelete && (
              <button type="button" className="btn btn-secondary btn-sm" onClick={removeShot} disabled={uploading}>
                Remove
              </button>
            )}
          </div>
        </div>

        {!iap.canViewReviewScreenshot ? (
          <div className="card-body"><span className="muted">Backend does not expose review screenshots for this IAP.</span></div>
        ) : !iap.isReviewScreenshotLoaded ? (
          <div className="card-body">
            <div className="loading"><span className="spinner" /><span>Loading screenshot…</span></div>
          </div>
        ) : screenshot ? (
          <div className="card-body" style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            {screenshot.previewUrl ? (
              <img
                src={screenshot.previewUrl}
                alt="Review screenshot"
                style={{
                  maxWidth: 240, maxHeight: 320,
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                }}
              />
            ) : (
              <div className="muted">No preview available.</div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span className="cell-mono">{screenshot.fileName}</span>
              <span className="muted">Reviewers see this attached to your submission.</span>
            </div>
          </div>
        ) : (
          <div className="card-body" style={{ textAlign: 'center', padding: 24 }}>
            <div style={{ fontSize: 28, opacity: 0.4 }}>📷</div>
            <p className="muted" style={{ marginTop: 4, marginBottom: 8 }}>
              No screenshot uploaded yet.
            </p>
            {iap.canUploadReviewScreenshot && (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={triggerUpload}
                disabled={uploading}
              >
                {uploading ? 'Uploading…' : 'Upload Screenshot'}
              </button>
            )}
          </div>
        )}
        {shotError && (
          <div className="card-body" style={{ paddingTop: 0 }}>
            <span className="form-hint" style={{ color: 'var(--danger-text)' }}>{shotError}</span>
          </div>
        )}
      </div>

      {/* Review notes */}
      <div className="card">
        <div className="toolbar">
          <div className="toolbar-left">
            <h3>Review Notes</h3>
            <span className="muted" style={{ marginLeft: 8 }}>
              Optional · explain how to test this IAP
            </span>
          </div>
          <div className="toolbar-right" style={{ display: 'flex', gap: 6 }}>
            {noteDirty && !savingNote && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setNote(iap.reviewNote ?? '')}
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
            rows={4}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Use sandbox account reviewer@example.com to test this IAP."
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

export const IAPReviewTab = observer(IAPReviewTabImpl);
