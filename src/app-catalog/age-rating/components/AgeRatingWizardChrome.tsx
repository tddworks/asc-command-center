import {
  AGE_RATING_WIZARD_STEPS,
  AGE_RATING_STEP_META,
  stepNumber,
  isFirstStep,
  isLastStep,
  AgeRatingWizardStep,
} from '../AgeRatingWizardStep.ts';

/**
 * Progress header — mirrors AppMate's SwiftUI layout:
 *   [Step N pill] [Step title]                       [N of 7]
 *   ══════ ══════ ────── ────── ────── ────── ──────   (seven bars)
 *
 * The Step pill stays constant visual weight; the label next to it names
 * the current step; the right-hand counter tells the user how far they've
 * come. Bars below give a one-glance progress view.
 */
export function StepProgressIndicator({ currentStep }: { currentStep: AgeRatingWizardStep }) {
  const currentIdx = AGE_RATING_WIZARD_STEPS.indexOf(currentStep);
  const total = AGE_RATING_WIZARD_STEPS.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          padding: '4px 12px',
          background: 'var(--accent, #2563eb)',
          color: '#fff',
          borderRadius: 999,
          fontSize: 12,
          fontWeight: 600,
          whiteSpace: 'nowrap',
        }}>
          Step {stepNumber(currentStep)}
        </span>
        <span style={{
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--text-primary)',
        }}>
          {AGE_RATING_STEP_META[currentStep].title}
        </span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>
          {stepNumber(currentStep)} of {total}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 4 }}>
        {AGE_RATING_WIZARD_STEPS.map((step, idx) => {
          const isDone = idx < currentIdx;
          const isActive = idx === currentIdx;
          return (
            <div
              key={step}
              style={{
                flex: 1,
                height: 3,
                borderRadius: 2,
                background: isActive
                  ? 'var(--accent, #2563eb)'
                  : isDone
                    ? 'var(--text-secondary)'
                    : 'var(--border)',
                transition: 'background 200ms',
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

interface WizardNavigationProps {
  currentStep: AgeRatingWizardStep;
  isSaving: boolean;
  canSave: boolean;
  onBack: () => void;
  onCancel: () => void;
  onNext: () => void;
  onSave: () => void;
  /** Optional step-specific quick action shown left of the main buttons,
   *  e.g. "No to all" on boolean steps. */
  leftAction?: { label: string; onClick: () => void };
}

/** Back / [leftAction] / Cancel / Next | Save footer. Back is hidden on
 *  step 1 to keep the flow linear; Next morphs into Save on the last step. */
export function WizardNavigation({
  currentStep, isSaving, canSave, onBack, onCancel, onNext, onSave, leftAction,
}: WizardNavigationProps) {
  const first = isFirstStep(currentStep);
  const last  = isLastStep(currentStep);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
      {!first && (
        <button type="button" className="btn btn-secondary" onClick={onBack} disabled={isSaving}>
          Back
        </button>
      )}
      <div style={{ flex: 1 }} />
      {leftAction && (
        <button type="button" className="btn btn-secondary" onClick={leftAction.onClick} disabled={isSaving}>
          {leftAction.label}
        </button>
      )}
      <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={isSaving}>
        Cancel
      </button>
      {last ? (
        <button type="button" className="btn btn-primary" onClick={onSave} disabled={isSaving || !canSave}>
          {isSaving ? 'Saving…' : 'Save'}
        </button>
      ) : (
        <button type="button" className="btn btn-primary" onClick={onNext} disabled={isSaving}>
          Next
        </button>
      )}
    </div>
  );
}
