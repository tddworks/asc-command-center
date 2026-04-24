import { observer } from 'mobx-react-lite';
import type { AgeRatingDeclaration } from '../../AgeRatingDeclaration.ts';
import { FrequencyRow, SectionCard } from '../AgeRatingRows.tsx';

export const ViolenceStep = observer(function ViolenceStep({
  declaration,
}: { declaration: AgeRatingDeclaration }) {
  return (
    <SectionCard title="Violence">
      <FrequencyRow
        title="Cartoon or Fantasy Violence"
        description="Stylised, unrealistic combat or slapstick."
        value={declaration.violenceCartoonOrFantasy}
        onChange={(v) => declaration.violenceCartoonOrFantasy = v}
      />
      <FrequencyRow
        title="Realistic Violence"
        description="Realistic combat or physical aggression."
        value={declaration.violenceRealistic}
        onChange={(v) => declaration.violenceRealistic = v}
      />
      <FrequencyRow
        title="Prolonged or Graphic Violence"
        description="Extended, graphic, or sadistic realistic violence."
        value={declaration.violenceRealisticProlongedGraphicOrSadistic}
        onChange={(v) => declaration.violenceRealisticProlongedGraphicOrSadistic = v}
      />
      <FrequencyRow
        title="Guns or Other Weapons"
        description="Firearms, explosives, or similar weapons."
        value={declaration.gunsOrOtherWeapons}
        onChange={(v) => declaration.gunsOrOtherWeapons = v}
      />
    </SectionCard>
  );
});
