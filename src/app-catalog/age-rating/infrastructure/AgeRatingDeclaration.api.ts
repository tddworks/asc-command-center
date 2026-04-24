import { AgeRatingDeclaration } from '../AgeRatingDeclaration.ts';
import type { AgeRatingDeclarationRepository } from '../AgeRatingDeclarationRepository.ts';
import { apiClient, type DataMode } from '../../../shared/api-client.tsx';
import { MockAgeRatingDeclarationRepository } from './AgeRatingDeclaration.mock.ts';

/**
 * REST adapter for AgeRatingDeclaration.
 *
 * The save path is a single PATCH — Apple models age rating as one flat
 * resource. We look up the URL through `loc.updateUrl` which accepts either
 * `updateAgeRatingDeclaration` (verb+resource) or the shorter `update`. No
 * silent mock fallback: a missing affordance throws with a descriptive
 * message listing what the backend shipped.
 */
export class RestAgeRatingDeclarationRepository implements AgeRatingDeclarationRepository {
  async get(id: string): Promise<AgeRatingDeclaration> {
    const resp = await apiClient.get<{ data: Record<string, unknown> }>(
      `/api/v1/age-rating-declarations/${id}`,
    );
    const row = (Array.isArray(resp.data) ? resp.data[0] : resp.data) as Record<string, unknown>;
    const decl = AgeRatingDeclaration.fromJSON(row ?? { id });
    decl.setRepository(this);
    return decl;
  }

  async update(declaration: AgeRatingDeclaration): Promise<void> {
    const url = declaration.updateUrl;
    if (!url) {
      throw new Error(
        `[AgeRating] update: backend didn't expose [updateAgeRatingDeclaration, update] ` +
        `on declaration ${declaration.id}. Present affordances: ` +
        `[${Object.keys(declaration.affordances).join(', ') || '(none)'}]. ` +
        'Add one to the age-rating-declarations response _links.',
      );
    }
    const res = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(declaration.toUpdatePayload()),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`PATCH ${url} failed: ${res.status} ${text}`);
    }
  }
}

export async function ageRatingRepositoryFor(mode: DataMode): Promise<AgeRatingDeclarationRepository> {
  if (mode === 'mock') return new MockAgeRatingDeclarationRepository();
  return new RestAgeRatingDeclarationRepository();
}
