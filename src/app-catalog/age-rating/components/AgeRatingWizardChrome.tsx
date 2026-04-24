import {
  AGE_RATING_WIZARD_STEPS,
  AGE_RATING_STEP_META,
  stepNumber,
  isFirstStep,
  isLastStep,
  AgeRatingWizardStep,
} from '../AgeRatingWizardStep.ts';

/**
 * Tiny horizontal progress strip: seven dots, the active one emphasised,
 * completed ones filled. Labels stay compact so the wizard header stays
 * breezy and doesn't compete with the step title.
 */
export function StepProgressIndicator({ currentStep }: { currentStep: AgeRatingWizardStep }) {
  const currentIdx = AGE_RATING_WIZARD_STEPS.indexOf(currentStep);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      {AGE_RATING_WIZARD_STEPS.map((step, idx) => {
        const isActive = step === currentStep;
        const isDone = idx < currentIdx;
        const bg = isActive
          ? 'var(--accent, #2563eb)'
          : isDone
            ? 'var(--text-secondary)'
            : 'var(--border)';
        const color = isActive || isDone ? '#fff' : 'var(--text-muted)';
        return (
          <div
            key={step}
            title={AGE_RATING_STEP_META[step].title}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 10px',
              background: bg,
              color,
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 600,
              whiteSpace: 'nowrap',
              transition: 'all 120ms',
            }}
          >
            <span>{stepNumber(step)}</span>
            {isActive && <span style={{ fontWeight: 500 }}>{AGE_RATING_STEP_META[step].title}</span>}
          </div>
        );
      })}
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
}

/** Back / Cancel / Next | Save footer — the Next button morphs into Save
 *  on the last step. Back is hidden on step 1 to keep the flow linear. */
export function WizardNavigation({
  currentStep, isSaving, canSave, onBack, onCancel, onNext, onSave,
}: WizardNavigationProps) {
  const first = isFirstStep(currentStep);
  const last  = isLastStep(currentStep);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {!first && (
        <button type="button" className="btn btn-secondary" onClick={onBack} disabled={isSaving}>
          Back
        </button>
      )}
      <div style={{ flex: 1 }} />
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
