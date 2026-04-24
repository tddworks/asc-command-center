import { observer } from 'mobx-react-lite';
import type { AgeRatingDeclaration } from '../../AgeRatingDeclaration.ts';
import { BooleanRow, FrequencyRow, SectionCard } from '../AgeRatingRows.tsx';

export const MedicalStep = observer(function MedicalStep({
  declaration,
}: { declaration: AgeRatingDeclaration }) {
  return (
    <>
      <SectionCard title="Medical or Wellness">
        <FrequencyRow
          title="Medical or Treatment Information"
          description="Clinical content, diagnoses, or treatment guidance."
          value={declaration.medicalOrTreatmentInformation}
          onChange={(v) => declaration.medicalOrTreatmentInformation = v}
        />
      </SectionCard>

      <SectionCard title="Select if the app has…">
        <BooleanRow
          title="Health or Wellness Topics"
          description="Fitness, nutrition, mental wellbeing, etc."
          value={declaration.isHealthOrWellnessTopics}
          onChange={(v) => declaration.isHealthOrWellnessTopics = v}
        />
      </SectionCard>
    </>
  );
});
