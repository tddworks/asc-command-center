/**
 * Seven-step wizard order, mirroring Apple's App Store Connect flow. Each
 * step maps 1:1 to a domain section — the wizard UI uses this enum for
 * navigation, progress rendering, and step-title lookup.
 */
export enum AgeRatingWizardStep {
  Features               = 'features',
  MatureThemes           = 'matureThemes',
  MedicalOrWellness      = 'medicalOrWellness',
  SexualityOrNudity      = 'sexualityOrNudity',
  Violence               = 'violence',
  ChanceBasedActivities  = 'chanceBasedActivities',
  AdditionalInformation  = 'additionalInformation',
}

/** Canonical ordered list. The index is the 1-based step number. */
export const AGE_RATING_WIZARD_STEPS: readonly AgeRatingWizardStep[] = [
  AgeRatingWizardStep.Features,
  AgeRatingWizardStep.MatureThemes,
  AgeRatingWizardStep.MedicalOrWellness,
  AgeRatingWizardStep.SexualityOrNudity,
  AgeRatingWizardStep.Violence,
  AgeRatingWizardStep.ChanceBasedActivities,
  AgeRatingWizardStep.AdditionalInformation,
];

export interface AgeRatingStepMeta {
  readonly title: string;
  readonly instruction: string;
}

export const AGE_RATING_STEP_META: Record<AgeRatingWizardStep, AgeRatingStepMeta> = {
  [AgeRatingWizardStep.Features]: {
    title: 'Features',
    instruction: 'Does your app include any of these controls or capabilities?',
  },
  [AgeRatingWizardStep.MatureThemes]: {
    title: 'Mature Themes',
    instruction: 'How frequently does your app present profanity, horror, or drug/alcohol references?',
  },
  [AgeRatingWizardStep.MedicalOrWellness]: {
    title: 'Medical or Wellness',
    instruction: 'Does your app contain medical or wellness information?',
  },
  [AgeRatingWizardStep.SexualityOrNudity]: {
    title: 'Sexuality or Nudity',
    instruction: 'How frequently does your app show suggestive or sexual content?',
  },
  [AgeRatingWizardStep.Violence]: {
    title: 'Violence',
    instruction: 'How frequently does your app depict violence?',
  },
  [AgeRatingWizardStep.ChanceBasedActivities]: {
    title: 'Chance-Based Activities',
    instruction: 'Does your app include gambling, contests, or loot boxes?',
  },
  [AgeRatingWizardStep.AdditionalInformation]: {
    title: 'Additional Information',
    instruction: 'Review the calculated rating and finalize age categories.',
  },
};

export function stepNumber(step: AgeRatingWizardStep): number {
  return AGE_RATING_WIZARD_STEPS.indexOf(step) + 1;
}

export function nextStep(step: AgeRatingWizardStep): AgeRatingWizardStep | null {
  const idx = AGE_RATING_WIZARD_STEPS.indexOf(step);
  return AGE_RATING_WIZARD_STEPS[idx + 1] ?? null;
}

export function previousStep(step: AgeRatingWizardStep): AgeRatingWizardStep | null {
  const idx = AGE_RATING_WIZARD_STEPS.indexOf(step);
  return idx > 0 ? AGE_RATING_WIZARD_STEPS[idx - 1] : null;
}

export function isLastStep(step: AgeRatingWizardStep): boolean {
  return step === AgeRatingWizardStep.AdditionalInformation;
}

export function isFirstStep(step: AgeRatingWizardStep): boolean {
  return step === AgeRatingWizardStep.Features;
}
