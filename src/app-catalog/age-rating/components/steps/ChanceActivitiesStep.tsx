import { observer } from 'mobx-react-lite';
import type { AgeRatingDeclaration } from '../../AgeRatingDeclaration.ts';
import { BooleanRow, FrequencyRow, SectionCard } from '../AgeRatingRows.tsx';

export const ChanceActivitiesStep = observer(function ChanceActivitiesStep({
  declaration,
}: { declaration: AgeRatingDeclaration }) {
  return (
    <>
      <SectionCard title="Chance-Based Activities">
        <FrequencyRow
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

      <SectionCard title="Select if the app has…">
        <BooleanRow
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
