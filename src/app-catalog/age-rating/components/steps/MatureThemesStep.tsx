import { observer } from 'mobx-react-lite';
import type { AgeRatingDeclaration } from '../../AgeRatingDeclaration.ts';
import {
  FrequencyRow,
  FrequencySectionHeader,
  SectionCard,
} from '../AgeRatingRows.tsx';
import { QuestionIcon } from '../AgeRatingIcons.tsx';

export const MatureThemesStep = observer(function MatureThemesStep({
  declaration,
}: { declaration: AgeRatingDeclaration }) {
  return (
    <SectionCard>
      <FrequencySectionHeader title="Mature Themes" icon={<QuestionIcon />} />
      <FrequencyRow
        first
        title="Profanity or Crude Humor"
        description="Swearing, vulgarity, or crude jokes."
        value={declaration.profanityOrCrudeHumor}
        onChange={(v) => declaration.profanityOrCrudeHumor = v}
      />
      <FrequencyRow
        title="Horror or Fear Themes"
        description="Jump scares, disturbing imagery, or frightening content."
        value={declaration.horrorOrFearThemes}
        onChange={(v) => declaration.horrorOrFearThemes = v}
      />
      <FrequencyRow
        title="Alcohol, Tobacco, or Drug Use"
        description="References to or depictions of these substances."
        value={declaration.alcoholTobaccoOrDrugUseOrReferences}
        onChange={(v) => declaration.alcoholTobaccoOrDrugUseOrReferences = v}
      />
    </SectionCard>
  );
});
