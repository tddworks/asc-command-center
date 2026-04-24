import { makeAutoObservable, runInAction } from 'mobx';
import type { Affordances } from '../../shared/types.ts';
// Type-only import — the port depends on this class, so runtime cycle
// resolution needs the import to drop away.
import type { AgeRatingDeclarationRepository } from './AgeRatingDeclarationRepository.ts';

/** Apple's three-level frequency scale for mature content declarations. */
export enum ContentFrequency {
  None = 'NONE',
  InfrequentMild = 'INFREQUENT_OR_MILD',
  FrequentIntense = 'FREQUENT_OR_INTENSE',
}

/** V2 override — replaces the legacy `ageRatingOverride` field. Sending both
 *  at once is a 422 from Apple, so when the user picks a V2 value we always
 *  null out the legacy field. */
export enum AgeRatingOverride {
  None = 'NONE',
  NinePlus = 'NINE_PLUS',
  TwelvePlus = 'TWELVE_PLUS',
  SeventeenPlus = 'SEVENTEEN_PLUS',
  Unrated = 'UNRATED',
}

/** Kids category — mutually exclusive with `ageRatingOverrideV2 !== NONE`. */
export enum KidsAgeBand {
  FiveAndUnder = 'FIVE_AND_UNDER',
  SixToEight = 'SIX_TO_EIGHT',
  NineToEleven = 'NINE_TO_ELEVEN',
}

/** The computed rating Apple returns after it evaluates the declaration. */
export enum AppStoreAgeRating {
  FourPlus = 'FOUR_PLUS',
  NinePlus = 'NINE_PLUS',
  TwelvePlus = 'TWELVE_PLUS',
  SeventeenPlus = 'SEVENTEEN_PLUS',
  Unrated = 'UNRATED',
}

export interface AgeRatingDeclarationInit {
  id: string;
  affordances?: Affordances;
  /** Apple-computed rating — read-only, surfaced alongside the editor. */
  appStoreAgeRating?: AppStoreAgeRating | null;

  // ── Boolean flags ──
  isParentalControls?: boolean | null;
  isAgeAssurance?: boolean | null;
  isUnrestrictedWebAccess?: boolean | null;
  isUserGeneratedContent?: boolean | null;
  isMessagingAndChat?: boolean | null;
  isAdvertising?: boolean | null;
  isHealthOrWellnessTopics?: boolean | null;
  isGambling?: boolean | null;
  isLootBox?: boolean | null;

  // ── Frequency (ContentFrequency) ──
  profanityOrCrudeHumor?: ContentFrequency | null;
  horrorOrFearThemes?: ContentFrequency | null;
  alcoholTobaccoOrDrugUseOrReferences?: ContentFrequency | null;
  medicalOrTreatmentInformation?: ContentFrequency | null;
  matureOrSuggestiveThemes?: ContentFrequency | null;
  sexualContentOrNudity?: ContentFrequency | null;
  sexualContentGraphicAndNudity?: ContentFrequency | null;
  violenceCartoonOrFantasy?: ContentFrequency | null;
  violenceRealistic?: ContentFrequency | null;
  violenceRealisticProlongedGraphicOrSadistic?: ContentFrequency | null;
  gunsOrOtherWeapons?: ContentFrequency | null;
  gamblingSimulated?: ContentFrequency | null;
  contests?: ContentFrequency | null;

  // ── Override / categorisation ──
  ageRatingOverrideV2?: AgeRatingOverride | null;
  /** Legacy field — keep so hydration is lossless, but the setter for V2
   *  clears it to avoid the "both set" API error. */
  ageRatingOverride?: AgeRatingOverride | null;
  koreaAgeRatingOverride?: AgeRatingOverride | null;
  kidsAgeBand?: KidsAgeBand | null;
  developerAgeRatingInfoURL?: string | null;
}

/**
 * AgeRatingDeclaration — aggregate for the age rating questionnaire. Mirrors
 * Apple's resource field-for-field and maps 1:1 to the wizard's 7 steps.
 *
 * Mutability: every declarative field is mutable. `null` means "not answered
 * yet" (or "cleared") and round-trips through PATCH; the computed
 * `appStoreAgeRating` is read-only.
 */
export class AgeRatingDeclaration {
  readonly id: string;
  affordances: Affordances;
  appStoreAgeRating: AppStoreAgeRating | null;

  // Boolean flags
  isParentalControls: boolean | null;
  isAgeAssurance: boolean | null;
  isUnrestrictedWebAccess: boolean | null;
  isUserGeneratedContent: boolean | null;
  isMessagingAndChat: boolean | null;
  isAdvertising: boolean | null;
  isHealthOrWellnessTopics: boolean | null;
  isGambling: boolean | null;
  isLootBox: boolean | null;

  // Frequency fields
  profanityOrCrudeHumor: ContentFrequency | null;
  horrorOrFearThemes: ContentFrequency | null;
  alcoholTobaccoOrDrugUseOrReferences: ContentFrequency | null;
  medicalOrTreatmentInformation: ContentFrequency | null;
  matureOrSuggestiveThemes: ContentFrequency | null;
  sexualContentOrNudity: ContentFrequency | null;
  sexualContentGraphicAndNudity: ContentFrequency | null;
  violenceCartoonOrFantasy: ContentFrequency | null;
  violenceRealistic: ContentFrequency | null;
  violenceRealisticProlongedGraphicOrSadistic: ContentFrequency | null;
  gunsOrOtherWeapons: ContentFrequency | null;
  gamblingSimulated: ContentFrequency | null;
  contests: ContentFrequency | null;

  // Override + categorisation
  ageRatingOverrideV2: AgeRatingOverride | null;
  ageRatingOverride: AgeRatingOverride | null;
  koreaAgeRatingOverride: AgeRatingOverride | null;
  kidsAgeBand: KidsAgeBand | null;
  developerAgeRatingInfoURL: string | null;

  repository: AgeRatingDeclarationRepository | null = null;

  private snapshot: Snapshot;

  constructor(init: AgeRatingDeclarationInit) {
    this.id = init.id;
    this.affordances = init.affordances ?? {};
    this.appStoreAgeRating = init.appStoreAgeRating ?? null;

    this.isParentalControls = init.isParentalControls ?? null;
    this.isAgeAssurance = init.isAgeAssurance ?? null;
    this.isUnrestrictedWebAccess = init.isUnrestrictedWebAccess ?? null;
    this.isUserGeneratedContent = init.isUserGeneratedContent ?? null;
    this.isMessagingAndChat = init.isMessagingAndChat ?? null;
    this.isAdvertising = init.isAdvertising ?? null;
    this.isHealthOrWellnessTopics = init.isHealthOrWellnessTopics ?? null;
    this.isGambling = init.isGambling ?? null;
    this.isLootBox = init.isLootBox ?? null;

    this.profanityOrCrudeHumor = init.profanityOrCrudeHumor ?? null;
    this.horrorOrFearThemes = init.horrorOrFearThemes ?? null;
    this.alcoholTobaccoOrDrugUseOrReferences = init.alcoholTobaccoOrDrugUseOrReferences ?? null;
    this.medicalOrTreatmentInformation = init.medicalOrTreatmentInformation ?? null;
    this.matureOrSuggestiveThemes = init.matureOrSuggestiveThemes ?? null;
    this.sexualContentOrNudity = init.sexualContentOrNudity ?? null;
    this.sexualContentGraphicAndNudity = init.sexualContentGraphicAndNudity ?? null;
    this.violenceCartoonOrFantasy = init.violenceCartoonOrFantasy ?? null;
    this.violenceRealistic = init.violenceRealistic ?? null;
    this.violenceRealisticProlongedGraphicOrSadistic = init.violenceRealisticProlongedGraphicOrSadistic ?? null;
    this.gunsOrOtherWeapons = init.gunsOrOtherWeapons ?? null;
    this.gamblingSimulated = init.gamblingSimulated ?? null;
    this.contests = init.contests ?? null;

    this.ageRatingOverrideV2 = init.ageRatingOverrideV2 ?? null;
    this.ageRatingOverride = init.ageRatingOverride ?? null;
    this.koreaAgeRatingOverride = init.koreaAgeRatingOverride ?? null;
    this.kidsAgeBand = init.kidsAgeBand ?? null;
    this.developerAgeRatingInfoURL = init.developerAgeRatingInfoURL ?? null;

    this.snapshot = this.captureSnapshot();
    makeAutoObservable(this, { id: false, repository: false });
  }

  setRepository(repo: AgeRatingDeclarationRepository): void {
    this.repository = repo;
  }

  // ── Capability checks ──

  get canUpdate(): boolean {
    return (
      'updateAgeRatingDeclaration' in this.affordances ||
      'update' in this.affordances
    );
  }

  /** First matching URL for the PATCH. Accepts the verb+resource variant the
   *  backend is likely to ship AND the shorter `update`. Mirrors the pattern
   *  used by AppInfoLocalization. */
  get updateUrl(): string | null {
    return this.affordances.updateAgeRatingDeclaration ?? this.affordances.update ?? null;
  }

  // ── Display ──

  /** The computed rating, defaulted to FOUR_PLUS for display when the
   *  backend hasn't returned anything yet — matches Apple's convention. */
  get displayRating(): AppStoreAgeRating {
    return this.appStoreAgeRating ?? AppStoreAgeRating.FourPlus;
  }

  /** True when the user has answered at least one question. Drives the
   *  "not yet rated" vs. "rated" visual state in the page-level card. */
  get hasAnyAnswer(): boolean {
    return BOOLEAN_FIELDS.some((k) => this[k] !== null)
      || FREQUENCY_FIELDS.some((k) => this[k] !== null)
      || this.ageRatingOverrideV2 !== null
      || this.kidsAgeBand !== null;
  }

  // ── Coupled setters ──
  //
  // Apple rejects any PATCH that sends both `ageRatingOverrideV2` AND the
  // legacy `ageRatingOverride` with non-null values at the same time. These
  // helpers encode the "pick one path" rule on the domain so the UI can't
  // accidentally violate it.

  chooseOverrideV2(value: AgeRatingOverride): void {
    this.ageRatingOverrideV2 = value;
    this.ageRatingOverride = null;
    this.kidsAgeBand = null;
  }

  chooseKidsAgeBand(band: KidsAgeBand): void {
    this.kidsAgeBand = band;
    this.ageRatingOverrideV2 = AgeRatingOverride.None;
    this.ageRatingOverride = null;
  }

  clearAgeCategory(): void {
    this.ageRatingOverrideV2 = AgeRatingOverride.None;
    this.ageRatingOverride = null;
    this.kidsAgeBand = null;
  }

  // ── Dirty tracking ──

  get hasUnsavedChanges(): boolean {
    const s = this.snapshot;
    for (const k of BOOLEAN_FIELDS)   if (this[k] !== s[k]) return true;
    for (const k of FREQUENCY_FIELDS) if (this[k] !== s[k]) return true;
    if (this.ageRatingOverrideV2     !== s.ageRatingOverrideV2)     return true;
    if (this.ageRatingOverride       !== s.ageRatingOverride)       return true;
    if (this.koreaAgeRatingOverride  !== s.koreaAgeRatingOverride)  return true;
    if (this.kidsAgeBand             !== s.kidsAgeBand)             return true;
    if (this.developerAgeRatingInfoURL !== s.developerAgeRatingInfoURL) return true;
    return false;
  }

  discard(): void {
    const s = this.snapshot;
    for (const k of BOOLEAN_FIELDS)   (this[k] as boolean | null) = s[k];
    for (const k of FREQUENCY_FIELDS) (this[k] as ContentFrequency | null) = s[k];
    this.ageRatingOverrideV2 = s.ageRatingOverrideV2;
    this.ageRatingOverride = s.ageRatingOverride;
    this.koreaAgeRatingOverride = s.koreaAgeRatingOverride;
    this.kidsAgeBand = s.kidsAgeBand;
    this.developerAgeRatingInfoURL = s.developerAgeRatingInfoURL;
  }

  markSaved(): void {
    this.snapshot = this.captureSnapshot();
  }

  // ── Save ──

  async save(): Promise<void> {
    if (!this.repository) {
      throw new Error(`AgeRatingDeclaration ${this.id} has no repository attached`);
    }
    await this.repository.update(this);
    runInAction(() => this.markSaved());
  }

  // ── Factory ──

  static fromJSON(json: Record<string, unknown>): AgeRatingDeclaration {
    const pick = <T>(key: keyof AgeRatingDeclarationInit): T | null =>
      (json[key as string] as T | null | undefined) ?? null;
    return new AgeRatingDeclaration({
      id: (json.id as string) ?? '',
      affordances: (json.affordances as Affordances | undefined) ?? {},
      appStoreAgeRating: pick<AppStoreAgeRating>('appStoreAgeRating'),

      isParentalControls:        pick<boolean>('isParentalControls'),
      isAgeAssurance:            pick<boolean>('isAgeAssurance'),
      isUnrestrictedWebAccess:   pick<boolean>('isUnrestrictedWebAccess'),
      isUserGeneratedContent:    pick<boolean>('isUserGeneratedContent'),
      isMessagingAndChat:        pick<boolean>('isMessagingAndChat'),
      isAdvertising:             pick<boolean>('isAdvertising'),
      isHealthOrWellnessTopics:  pick<boolean>('isHealthOrWellnessTopics'),
      isGambling:                pick<boolean>('isGambling'),
      isLootBox:                 pick<boolean>('isLootBox'),

      profanityOrCrudeHumor:                        pick<ContentFrequency>('profanityOrCrudeHumor'),
      horrorOrFearThemes:                           pick<ContentFrequency>('horrorOrFearThemes'),
      alcoholTobaccoOrDrugUseOrReferences:          pick<ContentFrequency>('alcoholTobaccoOrDrugUseOrReferences'),
      medicalOrTreatmentInformation:                pick<ContentFrequency>('medicalOrTreatmentInformation'),
      matureOrSuggestiveThemes:                     pick<ContentFrequency>('matureOrSuggestiveThemes'),
      sexualContentOrNudity:                        pick<ContentFrequency>('sexualContentOrNudity'),
      sexualContentGraphicAndNudity:                pick<ContentFrequency>('sexualContentGraphicAndNudity'),
      violenceCartoonOrFantasy:                     pick<ContentFrequency>('violenceCartoonOrFantasy'),
      violenceRealistic:                            pick<ContentFrequency>('violenceRealistic'),
      violenceRealisticProlongedGraphicOrSadistic:  pick<ContentFrequency>('violenceRealisticProlongedGraphicOrSadistic'),
      gunsOrOtherWeapons:                           pick<ContentFrequency>('gunsOrOtherWeapons'),
      gamblingSimulated:                            pick<ContentFrequency>('gamblingSimulated'),
      contests:                                     pick<ContentFrequency>('contests'),

      ageRatingOverrideV2:        pick<AgeRatingOverride>('ageRatingOverrideV2'),
      ageRatingOverride:          pick<AgeRatingOverride>('ageRatingOverride'),
      koreaAgeRatingOverride:     pick<AgeRatingOverride>('koreaAgeRatingOverride'),
      kidsAgeBand:                pick<KidsAgeBand>('kidsAgeBand'),
      developerAgeRatingInfoURL:  pick<string>('developerAgeRatingInfoURL'),
    });
  }

  /** Full PATCH body — every editable field, with `null` carrying "clear".
   *  The REST adapter reads this directly so there's one source of truth
   *  for what the domain considers "its state". */
  toUpdatePayload(): Record<string, unknown> {
    const body: Record<string, unknown> = {};
    for (const k of BOOLEAN_FIELDS)   body[k] = this[k];
    for (const k of FREQUENCY_FIELDS) body[k] = this[k];
    body.kidsAgeBand = this.kidsAgeBand;
    body.developerAgeRatingInfoURL = this.developerAgeRatingInfoURL;
    body.koreaAgeRatingOverride = this.koreaAgeRatingOverride;
    // Mutually-exclusive override pair — send V2 and omit legacy unless V2
    // is untouched. Apple rejects non-null pairs together.
    if (this.ageRatingOverrideV2 !== null) {
      body.ageRatingOverrideV2 = this.ageRatingOverrideV2;
      body.ageRatingOverride = null;
    } else {
      body.ageRatingOverride = this.ageRatingOverride;
    }
    return body;
  }

  // ── Snapshot ──

  private captureSnapshot(): Snapshot {
    const s = {} as Snapshot;
    for (const k of BOOLEAN_FIELDS)   s[k] = this[k];
    for (const k of FREQUENCY_FIELDS) s[k] = this[k];
    s.ageRatingOverrideV2 = this.ageRatingOverrideV2;
    s.ageRatingOverride = this.ageRatingOverride;
    s.koreaAgeRatingOverride = this.koreaAgeRatingOverride;
    s.kidsAgeBand = this.kidsAgeBand;
    s.developerAgeRatingInfoURL = this.developerAgeRatingInfoURL;
    return s;
  }
}

/** Keys of the boolean fields — used by generic dirty-tracking loops. */
export const BOOLEAN_FIELDS = [
  'isParentalControls',
  'isAgeAssurance',
  'isUnrestrictedWebAccess',
  'isUserGeneratedContent',
  'isMessagingAndChat',
  'isAdvertising',
  'isHealthOrWellnessTopics',
  'isGambling',
  'isLootBox',
] as const satisfies readonly (keyof AgeRatingDeclaration)[];

/** Keys of the frequency fields. */
export const FREQUENCY_FIELDS = [
  'profanityOrCrudeHumor',
  'horrorOrFearThemes',
  'alcoholTobaccoOrDrugUseOrReferences',
  'medicalOrTreatmentInformation',
  'matureOrSuggestiveThemes',
  'sexualContentOrNudity',
  'sexualContentGraphicAndNudity',
  'violenceCartoonOrFantasy',
  'violenceRealistic',
  'violenceRealisticProlongedGraphicOrSadistic',
  'gunsOrOtherWeapons',
  'gamblingSimulated',
  'contests',
] as const satisfies readonly (keyof AgeRatingDeclaration)[];

type Snapshot = {
  [K in (typeof BOOLEAN_FIELDS)[number]]: boolean | null;
} & {
  [K in (typeof FREQUENCY_FIELDS)[number]]: ContentFrequency | null;
} & {
  ageRatingOverrideV2: AgeRatingOverride | null;
  ageRatingOverride: AgeRatingOverride | null;
  koreaAgeRatingOverride: AgeRatingOverride | null;
  kidsAgeBand: KidsAgeBand | null;
  developerAgeRatingInfoURL: string | null;
};
