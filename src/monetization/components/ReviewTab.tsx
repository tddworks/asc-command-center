import { useEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';

export interface ReviewScreenshotLike {
  readonly fileName: string;
  readonly canDelete: boolean;
  /** Resolve a concrete image URL at the given display size (CSS px). */
  srcAt(displayWidth: number): string | null;
}

/** Structural shape both `InAppPurchase` and `Subscription` already
 *  satisfy — review note + screenshot upload/delete. */
export interface ProductWithReview<S extends ReviewScreenshotLike = ReviewScreenshotLike> {
  readonly reviewNote: string | null;
  updateReviewNote(note: string | null): Promise<void>;

  readonly reviewScreenshot: S | null;
  readonly isReviewScreenshotLoaded: boolean;
  readonly canViewReviewScreenshot: boolean;
  readonly canUploadReviewScreenshot: boolean;
  loadReviewScreenshot(): Promise<unknown>;
  uploadReviewScreenshot(file: File): Promise<unknown>;
  deleteReviewScreenshot(): Promise<void>;
}

export interface ReviewTabConfig {
  /** Subject noun used in copy ("IAP" / "subscription"). */
  subjectLabel: string;
  /** Whether the backend currently allows saving the review note. */
  canSaveNote: boolean;
  /** Stable DOM id used for the textarea + label association. */
  notesId: string;
  /** Sample text in the textarea placeholder. */
  notesPlaceholder: string;
}

interface Props<S extends ReviewScreenshotLike, P extends ProductWithReview<S>> {
  product: P;
  config: ReviewTabConfig;
}

/**
 * Shared review-screenshot + review-note tab used by IAP and Subscription
 * detail pages. Mirrors the iOS review tab structure.
 */
function ReviewTabImpl<S extends ReviewScreenshotLike, P extends ProductWithReview<S>>({
  product,
  config,
}: Props<S, P>) {
  const [note, setNote] = useState(product.reviewNote ?? '');
  const [savingNote, setSavingNote] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);

  const [uploading, setUploading] = useState(false);
  const [shotError, setShotError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setNote(product.reviewNote ?? '');
  }, [product.reviewNote]);

  useEffect(() => {
    if (product.isReviewScreenshotLoaded) return;
    void product.loadReviewScreenshot().catch((err) => {
      console.warn('[review-tab] loadReviewScreenshot failed:', err);
    });
  }, [product]);

  const noteDirty = (product.reviewNote ?? '') !== note;
  const canSaveNote = noteDirty && !savingNote && config.canSaveNote;

  const saveNote = async () => {
    setSavingNote(true);
    setNoteError(null);
    try {
      await product.updateReviewNote(note.length === 0 ? null : note);
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
    try { await product.uploadReviewScreenshot(file); }
    catch (err) { setShotError((err as Error).message); }
    finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeShot = async () => {
    if (!product.reviewScreenshot) return;
    if (!window.confirm('Remove this screenshot?')) return;
    setShotError(null);
    try { await product.deleteReviewScreenshot(); }
    catch (err) { setShotError((err as Error).message); }
  };

  const triggerUpload = () => fileInputRef.current?.click();
  const screenshot = product.reviewScreenshot;

  return (
    <div className="card">
      <div className="toolbar">
        <div className="toolbar-left"><h3>Review Information</h3></div>
      </div>

      <div className="card-body padded" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
            <label className="form-label" style={{ marginBottom: 0 }}>Review Screenshot</label>
            <span className="form-hint">Optional · helps reviewers verify the {config.subjectLabel}</span>
          </div>

          {!product.canViewReviewScreenshot ? (
            <span className="muted">Backend does not expose review screenshots for this {config.subjectLabel}.</span>
          ) : !product.isReviewScreenshotLoaded ? (
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
              {(() => {
                const src = screenshot.srcAt(120);
                return src ? (
                  <img
                    src={src}
                    alt="Review screenshot"
                    style={{
                      maxWidth: 120, maxHeight: 160,
                      border: '1px solid var(--border)',
                      borderRadius: 6,
                    }}
                  />
                ) : (
                  <div className="muted" style={{ width: 120, textAlign: 'center' }}>No preview</div>
                );
              })()}
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
                {product.canUploadReviewScreenshot && (
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
              {product.canUploadReviewScreenshot && (
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

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
            <label className="form-label" htmlFor={config.notesId} style={{ marginBottom: 0 }}>
              Review Notes
            </label>
            <span className="form-hint">Optional · explain how to test this {config.subjectLabel}</span>
          </div>
          <textarea
            id={config.notesId}
            className="form-input"
            rows={4}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={config.notesPlaceholder}
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
                  onClick={() => setNote(product.reviewNote ?? '')}
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

export const ReviewTab = observer(ReviewTabImpl) as typeof ReviewTabImpl;
