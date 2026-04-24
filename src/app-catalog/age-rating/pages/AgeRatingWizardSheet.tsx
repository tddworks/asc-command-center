import { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import type { AppInfo } from '../../app-info/AppInfo.ts';
import {
  AgeRatingDeclaration,
  BOOLEAN_FIELDS,
  FREQUENCY_FIELDS,
  ContentFrequency,
} from '../AgeRatingDeclaration.ts';
import {
  AgeRatingWizardStep,
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

const STEP_SUBTITLE: Record<AgeRatingWizardStep, string> = {
  [AgeRatingWizardStep.Features]:              "Select whether your app has certain in-app controls, which can be used to limit the content in your app, and capabilities.",
  [AgeRatingWizardStep.MatureThemes]:          "How frequently does your app present profanity, horror, or drug/alcohol references?",
  [AgeRatingWizardStep.MedicalOrWellness]:     "Does your app contain medical or wellness information?",
  [AgeRatingWizardStep.SexualityOrNudity]:     "How frequently does your app show suggestive or sexual content?",
  [AgeRatingWizardStep.Violence]:              "How frequently does your app depict violence?",
  [AgeRatingWizardStep.ChanceBasedActivities]: "Does your app include gambling, contests, or loot boxes?",
  [AgeRatingWizardStep.AdditionalInformation]: "Review the calculated rating and finalize age categories.",
};

/**
 * 7-step modal wizard. The modal uses a fixed height so the body scrolls
 * internally — switching steps never resizes the sheet, which kept jumping
 * around in the first pass.
 *
 * Boolean-only steps (Features, Chance + the boolean part of Medical) get
 * a "No to all" quick action in the footer that stamps `false` onto every
 * unanswered boolean on the current step's domain fields.
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

  const leftAction = declaration ? leftActionForStep(step, declaration) : undefined;

  return (
    <div className="modal-overlay open" role="dialog" aria-modal="true" aria-labelledby="ar-title">
      <div className="modal" style={{
        maxWidth: 900,
        width: '92vw',
        height: '82vh',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <div className="modal-header" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 14, padding: '20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
            <div style={{ minWidth: 0 }}>
              <h3 id="ar-title" style={{ marginBottom: 4 }}>Age Ratings</h3>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                {STEP_SUBTITLE[step]}
              </div>
            </div>
            <button type="button" className="modal-close" aria-label="Close" onClick={onClose}>✕</button>
          </div>
          <StepProgressIndicator currentStep={step} />
        </div>

        <div className="modal-body" style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
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
            leftAction={leftAction}
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
  const _exhaustive: never = step;
  return _exhaustive;
}

/**
 * "No to all" / "None to all" — stamps a safe default onto every field the
 * current step owns. Only offered on steps that ask questions; the final
 * review step doesn't get one. A value the user already picked is left
 * alone; only untouched (`null`) fields flip.
 */
function leftActionForStep(
  step: AgeRatingWizardStep,
  declaration: AgeRatingDeclaration,
): { label: string; onClick: () => void } | undefined {
  const booleanKeys = BOOLEAN_KEYS_BY_STEP[step];
  const frequencyKeys = FREQUENCY_KEYS_BY_STEP[step];
  if (!booleanKeys && !frequencyKeys) return undefined;

  const label = frequencyKeys && !booleanKeys ? 'None to all' : 'No to all';
  return {
    label,
    onClick: () => {
      if (booleanKeys) {
        for (const k of booleanKeys) {
          if (declaration[k] === null) (declaration[k] as boolean | null) = false;
        }
      }
      if (frequencyKeys) {
        for (const k of frequencyKeys) {
          if (declaration[k] === null) (declaration[k] as ContentFrequency | null) = ContentFrequency.None;
        }
      }
    },
  };
}

type BooleanKey = (typeof BOOLEAN_FIELDS)[number];
type FrequencyKey = (typeof FREQUENCY_FIELDS)[number];

const BOOLEAN_KEYS_BY_STEP: Partial<Record<AgeRatingWizardStep, readonly BooleanKey[]>> = {
  [AgeRatingWizardStep.Features]: [
    'isParentalControls', 'isAgeAssurance',
    'isUnrestrictedWebAccess', 'isUserGeneratedContent',
    'isMessagingAndChat', 'isAdvertising',
  ],
  [AgeRatingWizardStep.MedicalOrWellness]: ['isHealthOrWellnessTopics'],
  [AgeRatingWizardStep.ChanceBasedActivities]: ['isGambling', 'isLootBox'],
};

const FREQUENCY_KEYS_BY_STEP: Partial<Record<AgeRatingWizardStep, readonly FrequencyKey[]>> = {
  [AgeRatingWizardStep.MatureThemes]: [
    'profanityOrCrudeHumor',
    'horrorOrFearThemes',
    'alcoholTobaccoOrDrugUseOrReferences',
  ],
  [AgeRatingWizardStep.MedicalOrWellness]: ['medicalOrTreatmentInformation'],
  [AgeRatingWizardStep.SexualityOrNudity]: [
    'matureOrSuggestiveThemes',
    'sexualContentOrNudity',
    'sexualContentGraphicAndNudity',
  ],
  [AgeRatingWizardStep.Violence]: [
    'violenceCartoonOrFantasy',
    'violenceRealistic',
    'violenceRealisticProlongedGraphicOrSadistic',
    'gunsOrOtherWeapons',
  ],
  [AgeRatingWizardStep.ChanceBasedActivities]: [
    'gamblingSimulated',
    'contests',
  ],
};
