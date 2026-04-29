import { useEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';

export interface PromotionalImageLike {
  readonly id: string;
  readonly fileName: string;
  readonly canDelete: boolean;
  readonly isCompleted: boolean;
  readonly hasFailed: boolean;
  readonly stateLabel: string;
  readonly stateTone: 'success' | 'info' | 'warning' | 'danger' | 'neutral';
  srcAt(displayWidth: number): string | null;
}

/** Structural shape both `InAppPurchase` and `Subscription` already
 *  satisfy — promotional image list + upload/replace/delete. */
export interface ProductWithImages<I extends PromotionalImageLike = PromotionalImageLike> {
  readonly images: I[];
  readonly isImagesLoaded: boolean;
  readonly canViewImages: boolean;
  readonly canUploadImage: boolean;
  readonly hasExistingImage: boolean;
  loadImages(): Promise<unknown>;
  uploadImage(file: File): Promise<unknown>;
  replaceImage(old: I, file: File): Promise<unknown>;
  deleteImage(image: I): Promise<void>;
}

interface Props<I extends PromotionalImageLike, P extends ProductWithImages<I>> {
  product: P;
  /** Subject noun used in copy ("IAP" / "subscription"). */
  subjectLabel: string;
}

const TONE_TO_BADGE_CLASS: Record<PromotionalImageLike['stateTone'], string> = {
  success: 'badge-success',
  info: 'badge-info',
  warning: 'badge-warning',
  danger: 'badge-danger',
  neutral: 'badge-neutral',
};

/**
 * Promotional image section for the IAP / Subscription Review tab.
 * Mirrors the iOS `promotionalImagesSection` — list existing images with
 * state badge + replace/delete buttons, plus an "Add promotional image"
 * picker when no completed image exists (Apple allows one per product).
 */
function PromotionalImagesSectionImpl<
  I extends PromotionalImageLike,
  P extends ProductWithImages<I>,
>({ product, subjectLabel }: Props<I, P>) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const addInputRef = useRef<HTMLInputElement | null>(null);
  const replaceInputRef = useRef<HTMLInputElement | null>(null);
  const [replaceTarget, setReplaceTarget] = useState<I | null>(null);

  useEffect(() => {
    if (product.isImagesLoaded) return;
    void product.loadImages().catch((err) => {
      console.warn('[promo-images] loadImages failed:', err);
    });
  }, [product]);

  const onAdd = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try { await product.uploadImage(file); }
    catch (err) { setError((err as Error).message); }
    finally {
      setUploading(false);
      if (addInputRef.current) addInputRef.current.value = '';
    }
  };

  const onReplace = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !replaceTarget) return;
    const target = replaceTarget;
    setUploading(true);
    setError(null);
    try { await product.replaceImage(target, file); }
    catch (err) { setError((err as Error).message); }
    finally {
      setUploading(false);
      setReplaceTarget(null);
      if (replaceInputRef.current) replaceInputRef.current.value = '';
    }
  };

  const triggerReplace = (image: I) => {
    setReplaceTarget(image);
    replaceInputRef.current?.click();
  };

  const remove = async (image: I) => {
    if (!window.confirm('Remove this promotional image?')) return;
    setError(null);
    try { await product.deleteImage(image); }
    catch (err) { setError((err as Error).message); }
  };

  if (!product.canViewImages) return null;

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="toolbar">
        <div className="toolbar-left"><h3>Promotional Image</h3></div>
      </div>

      <div className="card-body padded" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {!product.isImagesLoaded ? (
          <div className="loading"><span className="spinner" /><span>Loading images…</span></div>
        ) : (
          <>
            {product.images.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {product.images.map((image) => {
                  const src = image.srcAt(120);
                  return (
                    <div
                      key={image.id}
                      style={{
                        display: 'flex',
                        gap: 12,
                        alignItems: 'center',
                        padding: 12,
                        border: '1px solid var(--border)',
                        borderRadius: 6,
                      }}
                    >
                      {src ? (
                        <img
                          src={src}
                          alt={image.fileName}
                          style={{
                            width: 120, height: 120,
                            objectFit: 'cover',
                            border: '1px solid var(--border)',
                            borderRadius: 6,
                          }}
                        />
                      ) : (
                        <div
                          className="muted"
                          style={{
                            width: 120, height: 120,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            border: '1px solid var(--border)', borderRadius: 6,
                          }}
                        >
                          {image.hasFailed ? '⚠︎' : '…'}
                        </div>
                      )}
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span className="cell-mono">{image.fileName}</span>
                        <span className={`badge ${TONE_TO_BADGE_CLASS[image.stateTone]}`}>
                          {image.stateLabel}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {image.isCompleted && image.canDelete && (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => triggerReplace(image)}
                            disabled={uploading}
                          >
                            {uploading && replaceTarget === image ? 'Replacing…' : 'Replace'}
                          </button>
                        )}
                        {image.canDelete && (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => remove(image)}
                            disabled={uploading}
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {!product.hasExistingImage && product.canUploadImage && (
              <>
                <input
                  ref={addInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={onAdd}
                />
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => addInputRef.current?.click()}
                  disabled={uploading}
                  style={{ alignSelf: 'flex-start' }}
                >
                  {uploading && !replaceTarget ? 'Uploading…' : '+ Add promotional image'}
                </button>
              </>
            )}

            <input
              ref={replaceInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={onReplace}
            />

            {error && (
              <div className="form-hint" style={{ color: 'var(--danger-text)' }}>
                {error}
              </div>
            )}

            <span className="form-hint">
              Square 1024×1024 image shown in App Store promotions for this {subjectLabel}. Apple allows one image per {subjectLabel}.
            </span>
          </>
        )}
      </div>
    </div>
  );
}

export const PromotionalImagesSection = observer(
  PromotionalImagesSectionImpl,
) as typeof PromotionalImagesSectionImpl;
