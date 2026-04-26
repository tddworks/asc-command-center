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
    <div className="card">
      <div className="toolbar">
        <div className="toolbar-left"><h3>Review Information</h3></div>
      </div>

      <div className="card-body padded" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Screenshot row */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
            <label className="form-label" style={{ marginBottom: 0 }}>Review Screenshot</label>
            <span className="form-hint">Optional · helps reviewers verify the IAP</span>
          </div>

          {!iap.canViewReviewScreenshot ? (
            <span className="muted">Backend does not expose review screenshots for this IAP.</span>
          ) : !iap.isReviewScreenshotLoaded ? (
            <div className="loading"><span className="spinner" /><span>Loading screenshot…</span></div>
          ) : screenshot ? (
            <div
              style={{
                display: 'flex',
                gap: 12,
                alignItems: 'center',
                padding: 12,
                border: '1px solid var(--border)',
                borderRadius: 6,
              }}
            >
              {screenshot.previewUrl ? (
                <img
                  src={screenshot.previewUrl}
                  alt="Review screenshot"
                  style={{
                    maxWidth: 120, maxHeight: 160,
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                  }}
                />
              ) : (
                <div className="muted" style={{ width: 120, textAlign: 'center' }}>No preview</div>
              )}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span className="cell-mono">{screenshot.fileName}</span>
                <span className="muted">Reviewers see this attached to your submission.</span>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={onPickFile}
                />
                {iap.canUploadReviewScreenshot && (
                  <button type="button" className="btn btn-secondary btn-sm" onClick={triggerUpload} disabled={uploading}>
                    {uploading ? 'Uploading…' : 'Replace'}
                  </button>
                )}
                {screenshot.canDelete && (
                  <button type="button" className="btn btn-secondary btn-sm" onClick={removeShot} disabled={uploading}>
                    Remove
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                gap: 12,
                alignItems: 'center',
                padding: 16,
                border: '2px dashed var(--border)',
                borderRadius: 6,
              }}
            >
              <div style={{ fontSize: 24, opacity: 0.5 }}>📷</div>
              <span className="muted" style={{ flex: 1 }}>No screenshot uploaded yet.</span>
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
                    className="btn btn-primary btn-sm"
                    onClick={triggerUpload}
                    disabled={uploading}
                  >
                    {uploading ? 'Uploading…' : 'Upload'}
                  </button>
                </>
              )}
            </div>
          )}
          {shotError && (
            <div className="form-hint" style={{ color: 'var(--danger-text)', marginTop: 6 }}>
              {shotError}
            </div>
          )}
        </div>

        {/* Notes row */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
            <label className="form-label" htmlFor="iap-review-notes" style={{ marginBottom: 0 }}>
              Review Notes
            </label>
            <span className="form-hint">Optional · explain how to test this IAP</span>
          </div>
          <textarea
            id="iap-review-notes"
            className="form-input"
            rows={4}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Use sandbox account reviewer@example.com to test this IAP."
          />
          {noteError && (
            <div className="form-hint" style={{ color: 'var(--danger-text)', marginTop: 6 }}>
              {noteError}
            </div>
          )}
          {(noteDirty || savingNote) && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 8 }}>
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
          )}
        </div>
      </div>
    </div>
  );
}

export const IAPReviewTab = observer(IAPReviewTabImpl);
