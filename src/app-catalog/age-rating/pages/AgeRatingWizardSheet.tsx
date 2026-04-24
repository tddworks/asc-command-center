import { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import type { AppInfo } from '../../app-info/AppInfo.ts';
import type { AgeRatingDeclaration } from '../AgeRatingDeclaration.ts';
import {
  AgeRatingWizardStep,
  AGE_RATING_STEP_META,
  nextStep,
  previousStep,
} from '../AgeRatingWizardStep.ts';
import { StepProgressIndicator, WizardNavigation } from '../components/AgeRatingWizardChrome.tsx';
import { FeaturesStep }          from '../components/steps/FeaturesStep.tsx';
import { MatureThemesStep }      from '../components/steps/MatureThemesStep.tsx';
import { MedicalStep }           from '../components/steps/MedicalStep.tsx';
import { SexualityStep }         from '../components/steps/SexualityStep.tsx';
import { ViolenceStep }          from '../components/steps/ViolenceStep.tsx';
import { ChanceActivitiesStep }  from '../components/steps/ChanceActivitiesStep.tsx';
import { AdditionalInfoStep }    from '../components/steps/AdditionalInfoStep.tsx';

interface Props {
  appInfo: AppInfo;
  onClose: () => void;
}

/**
 * 7-step modal wizard. Loads the declaration through the AppInfo's
 * navigation method (`loadAgeRating`), walks the user through each
 * category, then saves via the declaration's own `save()`. The wizard
 * doesn't do HTTP — it just drives state on the domain object.
 */
export const AgeRatingWizardSheet = observer(function AgeRatingWizardSheet({
  appInfo, onClose,
}: Props) {
  const [step, setStep] = useState<AgeRatingWizardStep>(AgeRatingWizardStep.Features);
  const [declaration, setDeclaration] = useState<AgeRatingDeclaration | null>(appInfo.ageRating);
  const [loading, setLoading] = useState(appInfo.ageRating === null);
  const [error, setError] = useState<Error | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Load the declaration on open if the AppInfo hasn't hydrated one yet.
  useEffect(() => {
    if (appInfo.ageRating) { setDeclaration(appInfo.ageRating); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    appInfo.loadAgeRating()
      .then((d) => { if (!cancelled) setDeclaration(d); })
      .catch((e) => { if (!cancelled) setError(e as Error); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [appInfo.id]);

  function goNext(): void {
    const n = nextStep(step);
    if (n) setStep(n);
  }
  function goBack(): void {
    const p = previousStep(step);
    if (p) setStep(p);
  }

  async function handleSave(): Promise<void> {
    if (!declaration) return;
    setSaving(true);
    setSaveError(null);
    try {
      await declaration.save();
      onClose();
    } catch (e) {
      setSaveError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay open" role="dialog" aria-modal="true" aria-labelledby="ar-title">
      <div className="modal" style={{ maxWidth: 860, width: '92vw' }}>
        <div className="modal-header" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 id="ar-title">Age Rating</h3>
            <button type="button" className="modal-close" aria-label="Close" onClick={onClose}>✕</button>
          </div>
          <StepProgressIndicator currentStep={step} />
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {AGE_RATING_STEP_META[step].instruction}
          </div>
        </div>

        <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          {loading && <div className="loading"><span className="spinner" /><span>Loading age rating…</span></div>}
          {error && (
            <div className="form-hint" role="alert" style={{ color: 'var(--danger-text, #b91c1c)' }}>
              {error.message}
            </div>
          )}
          {!loading && !declaration && !error && (
            <div className="empty-state">
              <h3>Not available</h3>
              <p>This app doesn't expose an age-rating declaration yet.</p>
            </div>
          )}
          {declaration && <StepBody step={step} declaration={declaration} />}

          {saveError && (
            <div className="form-hint" role="alert" style={{ color: 'var(--danger-text, #b91c1c)', marginTop: 12 }}>
              {saveError}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <WizardNavigation
            currentStep={step}
            isSaving={saving}
            canSave={!!declaration && declaration.hasUnsavedChanges}
            onBack={goBack}
            onCancel={onClose}
            onNext={goNext}
            onSave={handleSave}
          />
        </div>
      </div>
    </div>
  );
});

function StepBody({
  step, declaration,
}: { step: AgeRatingWizardStep; declaration: AgeRatingDeclaration }) {
  switch (step) {
    case AgeRatingWizardStep.Features:               return <FeaturesStep          declaration={declaration} />;
    case AgeRatingWizardStep.MatureThemes:           return <MatureThemesStep      declaration={declaration} />;
    case AgeRatingWizardStep.MedicalOrWellness:      return <MedicalStep           declaration={declaration} />;
    case AgeRatingWizardStep.SexualityOrNudity:      return <SexualityStep         declaration={declaration} />;
    case AgeRatingWizardStep.Violence:               return <ViolenceStep          declaration={declaration} />;
    case AgeRatingWizardStep.ChanceBasedActivities:  return <ChanceActivitiesStep  declaration={declaration} />;
    case AgeRatingWizardStep.AdditionalInformation:  return <AdditionalInfoStep    declaration={declaration} />;
  }
  // Exhaustive — TypeScript flags unhandled enum members.
  const _exhaustive: never = step;
  return _exhaustive;
}
