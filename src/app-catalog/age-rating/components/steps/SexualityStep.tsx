import { observer } from 'mobx-react-lite';
import type { AgeRatingDeclaration } from '../../AgeRatingDeclaration.ts';
import {
  FrequencyRow,
  FrequencySectionHeader,
  SectionCard,
} from '../AgeRatingRows.tsx';
import { HeartIcon } from '../AgeRatingIcons.tsx';

export const SexualityStep = observer(function SexualityStep({
  declaration,
}: { declaration: AgeRatingDeclaration }) {
  return (
    <SectionCard>
      <FrequencySectionHeader title="Sexuality or Nudity" icon={<HeartIcon />} />
      <FrequencyRow
        first
        title="Mature or Suggestive Themes"
        description="Innuendo or sexually suggestive presentation."
        value={declaration.matureOrSuggestiveThemes}
        onChange={(v) => declaration.matureOrSuggestiveThemes = v}
      />
      <FrequencyRow
        title="Sexual Content or Nudity"
        description="Non-graphic depictions of sexual content or nudity."
        value={declaration.sexualContentOrNudity}
        onChange={(v) => declaration.sexualContentOrNudity = v}
      />
      <FrequencyRow
        title="Graphic Sexual Content & Nudity"
        description="Explicit sexual content or full nudity."
        value={declaration.sexualContentGraphicAndNudity}
        onChange={(v) => declaration.sexualContentGraphicAndNudity = v}
      />
    </SectionCard>
  );
});
