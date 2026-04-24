import { observer } from 'mobx-react-lite';
import type { AgeRatingDeclaration } from '../../AgeRatingDeclaration.ts';
import {
  BooleanRow,
  BooleanSectionHeader,
  FrequencyRow,
  FrequencySectionHeader,
  SectionCard,
} from '../AgeRatingRows.tsx';
import { CheckmarkCircleIcon, MedicalIcon } from '../AgeRatingIcons.tsx';

export const MedicalStep = observer(function MedicalStep({
  declaration,
}: { declaration: AgeRatingDeclaration }) {
  return (
    <>
      <SectionCard>
        <FrequencySectionHeader title="Medical or Wellness" icon={<MedicalIcon />} />
        <FrequencyRow
          first
          title="Medical or Treatment Information"
          description="Clinical content, diagnoses, or treatment guidance."
          value={declaration.medicalOrTreatmentInformation}
          onChange={(v) => declaration.medicalOrTreatmentInformation = v}
        />
      </SectionCard>

      <SectionCard>
        <BooleanSectionHeader title="Select if the app has…" icon={<CheckmarkCircleIcon />} />
        <BooleanRow
          first
          title="Health or Wellness Topics"
          description="Fitness, nutrition, mental wellbeing, etc."
          value={declaration.isHealthOrWellnessTopics}
          onChange={(v) => declaration.isHealthOrWellnessTopics = v}
        />
      </SectionCard>
    </>
  );
});
