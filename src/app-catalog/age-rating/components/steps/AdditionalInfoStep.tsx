import { observer } from 'mobx-react-lite';
import {
  AgeRatingDeclaration,
  AgeRatingOverride,
  KidsAgeBand,
  AppStoreAgeRating,
} from '../../AgeRatingDeclaration.ts';
import { BooleanSectionHeader, SectionCard } from '../AgeRatingRows.tsx';
import { LinkIcon, PersonCheckIcon, StarCircleIcon } from '../AgeRatingIcons.tsx';

const RATING_LABEL: Record<AppStoreAgeRating, string> = {
  [AppStoreAgeRating.FourPlus]:      '4+',
  [AppStoreAgeRating.NinePlus]:      '9+',
  [AppStoreAgeRating.TwelvePlus]:    '12+',
  [AppStoreAgeRating.SeventeenPlus]: '17+',
  [AppStoreAgeRating.Unrated]:       '—',
};

const RATING_SUB: Record<AppStoreAgeRating, string> = {
  [AppStoreAgeRating.FourPlus]:      'No objectionable content',
  [AppStoreAgeRating.NinePlus]:      'Infrequent/mild content',
  [AppStoreAgeRating.TwelvePlus]:    'Frequent/intense content',
  [AppStoreAgeRating.SeventeenPlus]: 'Mature content',
  [AppStoreAgeRating.Unrated]:       'Not yet rated',
};

const RATING_COLOR: Record<AppStoreAgeRating, string> = {
  [AppStoreAgeRating.FourPlus]:      '#16a34a',
  [AppStoreAgeRating.NinePlus]:      '#2563eb',
  [AppStoreAgeRating.TwelvePlus]:    '#f59e0b',
  [AppStoreAgeRating.SeventeenPlus]: '#dc2626',
  [AppStoreAgeRating.Unrated]:       '#6b7280',
};

/**
 * Step 7 — review the computed rating, optionally override it to a higher
 * band or mark the app as "Made for Kids", and provide an age-suitability
 * URL. The three age-category states are mutually exclusive; the domain's
 * coupled setters (`chooseOverrideV2`, `chooseKidsAgeBand`, `clearAgeCategory`)
 * enforce the rule that Apple would otherwise 422 on.
 */
export const AdditionalInfoStep = observer(function AdditionalInfoStep({
  declaration,
}: { declaration: AgeRatingDeclaration }) {
  const rating = declaration.displayRating;

  // Derive the current UI state from the domain's mutually-exclusive fields.
  const category =
    declaration.ageRatingOverrideV2 && declaration.ageRatingOverrideV2 !== AgeRatingOverride.None
      ? 'override'
      : declaration.kidsAgeBand !== null
        ? 'kids'
        : 'none';

  return (
    <>
      <SectionCard>
        <BooleanSectionHeader title="Calculated Rating" icon={<StarCircleIcon />} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 16 }}>
          <div
            style={{
              width: 48, height: 48,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: RATING_COLOR[rating],
              color: '#fff',
              borderRadius: 10,
              fontWeight: 700, fontSize: 16,
            }}
          >
            {RATING_LABEL[rating]}
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>
              Ages {RATING_LABEL[rating]}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {RATING_SUB[rating]}
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard>
        <BooleanSectionHeader title="Age Categories" icon={<PersonCheckIcon />} />
        <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <CategoryRow
            selected={category === 'none'}
            label="Not Applicable"
            description="Use Apple's calculated rating without overrides."
            onSelect={() => declaration.clearAgeCategory()}
          />
          <CategoryRow
            selected={category === 'kids'}
            label="Made for Kids"
            description="Only available in select territories; Apple reviews kids category apps."
            onSelect={() => declaration.chooseKidsAgeBand(declaration.kidsAgeBand ?? KidsAgeBand.FiveAndUnder)}
            control={
              category === 'kids' ? (
                <select
                  className="form-input"
                  style={{ marginTop: 8, maxWidth: 240 }}
                  value={declaration.kidsAgeBand ?? KidsAgeBand.FiveAndUnder}
                  onChange={(e) => declaration.chooseKidsAgeBand(e.target.value as KidsAgeBand)}
                >
                  <option value={KidsAgeBand.FiveAndUnder}>Ages 5 and under</option>
                  <option value={KidsAgeBand.SixToEight}>Ages 6–8</option>
                  <option value={KidsAgeBand.NineToEleven}>Ages 9–11</option>
                </select>
              ) : null
            }
          />
          <CategoryRow
            selected={category === 'override'}
            label="Override to a Higher Rating"
            description="Force a rating above the calculated one."
            onSelect={() => declaration.chooseOverrideV2(
              declaration.ageRatingOverrideV2 && declaration.ageRatingOverrideV2 !== AgeRatingOverride.None
                ? declaration.ageRatingOverrideV2
                : AgeRatingOverride.NinePlus,
            )}
            control={
              category === 'override' ? (
                <select
                  className="form-input"
                  style={{ marginTop: 8, maxWidth: 240 }}
                  value={declaration.ageRatingOverrideV2 ?? AgeRatingOverride.NinePlus}
                  onChange={(e) => declaration.chooseOverrideV2(e.target.value as AgeRatingOverride)}
                >
                  <option value={AgeRatingOverride.NinePlus}>9+</option>
                  <option value={AgeRatingOverride.TwelvePlus}>12+</option>
                  <option value={AgeRatingOverride.SeventeenPlus}>17+</option>
                  <option value={AgeRatingOverride.Unrated}>Unrated</option>
                </select>
              ) : null
            }
          />
        </div>
      </SectionCard>

      <SectionCard>
        <BooleanSectionHeader title="Age Suitability URL" icon={<LinkIcon />} />
        <div style={{ padding: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
            Optional link to your own age-suitability explanation, shown on the App Store.
          </div>
          <input
            type="url"
            className="form-input"
            placeholder="https://example.com/age-info"
            value={declaration.developerAgeRatingInfoURL ?? ''}
            onChange={(e) => declaration.developerAgeRatingInfoURL = e.target.value || null}
          />
        </div>
      </SectionCard>
    </>
  );
});

function CategoryRow({
  selected, label, description, onSelect, control,
}: {
  selected: boolean;
  label: string;
  description: string;
  onSelect: () => void;
  control?: React.ReactNode;
}) {
  return (
    <div
      onClick={onSelect}
      role="button"
      tabIndex={0}
      style={{
        padding: 12,
        borderRadius: 8,
        border: `1px solid ${selected ? 'var(--accent, #2563eb)' : 'var(--border)'}`,
        background: selected ? 'rgba(37, 99, 235, 0.06)' : 'transparent',
        cursor: 'pointer',
        transition: 'all 120ms',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          style={{
            width: 16, height: 16, borderRadius: '50%',
            border: `2px solid ${selected ? 'var(--accent, #2563eb)' : 'var(--border)'}`,
            background: selected ? 'var(--accent, #2563eb)' : 'transparent',
            flexShrink: 0,
          }}
        />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{label}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{description}</div>
        </div>
      </div>
      {control}
    </div>
  );
}
