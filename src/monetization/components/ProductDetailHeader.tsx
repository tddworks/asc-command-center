import { useState, type ReactNode } from 'react';
import { InlineRename } from '../../shared/components/InlineRename.tsx';

export type StatusTone = 'success' | 'info' | 'warning' | 'danger' | 'neutral';

const STATUS_CLASS: Record<StatusTone, string> = {
  success: 'live',
  info: 'review',
  warning: 'pending',
  danger: 'rejected',
  neutral: 'draft',
};

interface Props {
  backLabel: string;
  onBack(): void;
  /** Display name shown via InlineRename. */
  name: string;
  /** Caller's PATCH handler for renames. */
  onRenameSave(value: string): Promise<void>;
  canEditName: boolean;
  renamePlaceholder?: string;
  /** Stable identifier shown next to the badges (`productId`). */
  productId: string;
  /** Right-side badges — IAP type, subscription period, Family flag, etc. */
  badges?: ReactNode;
  statusLabel: string;
  statusTone: StatusTone;

  canSubmit: boolean;
  canUnsubmit: boolean;
  onSubmit(): Promise<void>;
  onUnsubmit(): Promise<void>;
  /** When true, the unsubmit button uses the "Remove from Next Version"
   *  copy — Apple's wording for first-time IAPs queued for an app
   *  version's review. */
  isFirstTimeSubmission?: boolean;

  /** Below-the-actions hint shown when `canSubmit` is true but readiness
   *  isn't met (e.g. missing localizations). */
  submitHint?: string | null;
}

/**
 * Shared sticky header used by IAP detail and Subscription detail pages.
 * Owns the submit/cancel-submission state internally so both pages share
 * the same error handling.
 */
export function ProductDetailHeader({
  backLabel,
  onBack,
  name,
  onRenameSave,
  canEditName,
  renamePlaceholder,
  productId,
  badges,
  statusLabel,
  statusTone,
  canSubmit,
  canUnsubmit,
  onSubmit,
  onUnsubmit,
  isFirstTimeSubmission,
  submitHint,
}: Props) {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUnsubmitting, setIsUnsubmitting] = useState(false);

  const submit = async () => {
    setSubmitError(null);
    setIsSubmitting(true);
    try { await onSubmit(); }
    catch (err) { setSubmitError((err as Error).message); }
    finally { setIsSubmitting(false); }
  };
  const unsubmit = async () => {
    setSubmitError(null);
    setIsUnsubmitting(true);
    try { await onUnsubmit(); }
    catch (err) { setSubmitError((err as Error).message); }
    finally { setIsUnsubmitting(false); }
  };

  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <div className="toolbar" style={{ alignItems: 'flex-start' }}>
        <div className="toolbar-left" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onBack} style={{ marginBottom: 4 }}>
            ← {backLabel}
          </button>
          <InlineRename
            value={name}
            canEdit={canEditName}
            onSave={onRenameSave}
            placeholder={renamePlaceholder}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span className="cell-mono">{productId}</span>
            {badges}
            <span className={`status ${STATUS_CLASS[statusTone]}`}>{statusLabel}</span>
          </div>
        </div>
        <div className="toolbar-right" style={{ display: 'flex', gap: 6 }}>
          {canSubmit && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={submit}
              disabled={isSubmitting || isUnsubmitting}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              {isSubmitting && <span className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }} />}
              {isSubmitting
                ? (isFirstTimeSubmission ? 'Submitting…' : 'Submitting…')
                : (isFirstTimeSubmission ? 'Submit with Next Version' : 'Submit for Review')}
            </button>
          )}
          {canUnsubmit && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={unsubmit}
              disabled={isSubmitting || isUnsubmitting}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              {isUnsubmitting && <span className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }} />}
              {isUnsubmitting
                ? (isFirstTimeSubmission ? 'Removing…' : 'Cancelling…')
                : (isFirstTimeSubmission ? 'Remove from Next Version' : 'Cancel Submission')}
            </button>
          )}
        </div>
      </div>
      {submitError && (
        <div className="card-body" style={{ paddingTop: 0 }}>
          <span className="form-hint" style={{ color: 'var(--danger-text)' }}>{submitError}</span>
        </div>
      )}
      {submitHint && (
        <div className="card-body" style={{ paddingTop: 0 }}>
          <span className="form-hint" style={{ color: 'var(--danger-text)' }}>{submitHint}</span>
        </div>
      )}
    </div>
  );
}
