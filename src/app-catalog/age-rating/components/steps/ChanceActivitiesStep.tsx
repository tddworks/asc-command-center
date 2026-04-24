import { observer } from 'mobx-react-lite';
import type { AgeRatingDeclaration } from '../../AgeRatingDeclaration.ts';
import {
  BooleanRow,
  BooleanSectionHeader,
  FrequencyRow,
  FrequencySectionHeader,
  SectionCard,
} from '../AgeRatingRows.tsx';
import { CheckmarkCircleIcon, DiceIcon } from '../AgeRatingIcons.tsx';

export const ChanceActivitiesStep = observer(function ChanceActivitiesStep({
  declaration,
}: { declaration: AgeRatingDeclaration }) {
  return (
    <>
      <SectionCard>
        <FrequencySectionHeader title="Chance-Based Activities" icon={<DiceIcon />} />
        <FrequencyRow
          first
          title="Simulated Gambling"
          description="Casino-style games that don't use real currency."
          value={declaration.gamblingSimulated}
          onChange={(v) => declaration.gamblingSimulated = v}
        />
        <FrequencyRow
          title="Contests"
          description="Competitions with chance-based outcomes."
          value={declaration.contests}
          onChange={(v) => declaration.contests = v}
        />
      </SectionCard>

      <SectionCard>
        <BooleanSectionHeader title="Select if the app has…" icon={<CheckmarkCircleIcon />} />
        <BooleanRow
          first
          title="Gambling"
          description="Real-money wagering, betting, or lotteries."
          value={declaration.isGambling}
          onChange={(v) => declaration.isGambling = v}
        />
        <BooleanRow
          title="Loot Boxes"
          description="Randomised in-game rewards purchased with real or in-app currency."
          value={declaration.isLootBox}
          onChange={(v) => declaration.isLootBox = v}
        />
      </SectionCard>
    </>
  );
});
