import type { AgeRatingDeclaration } from './AgeRatingDeclaration.ts';

/**
 * Port for the AgeRatingDeclaration aggregate.
 *
 * Loading usually happens indirectly — AppInfo exposes `loadAgeRating()` via
 * its own affordance — so this port focuses on the update path. `get` is
 * available for direct lookups (e.g. deep-link, refresh).
 */
export interface AgeRatingDeclarationRepository {
  get(id: string): Promise<AgeRatingDeclaration>;
  update(declaration: AgeRatingDeclaration): Promise<void>;
}
