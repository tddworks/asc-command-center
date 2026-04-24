import { AgeRatingDeclaration } from '../AgeRatingDeclaration.ts';
import type { AgeRatingDeclarationRepository } from '../AgeRatingDeclarationRepository.ts';

/**
 * In-memory store keyed by declaration id. Fixtures echo Apple's shape —
 * every field defaults to null so the UI shows the "unanswered" state until
 * the user works through the wizard.
 */
export class MockAgeRatingDeclarationRepository implements AgeRatingDeclarationRepository {
  private store: Map<string, AgeRatingDeclaration> = new Map();

  async get(id: string): Promise<AgeRatingDeclaration> {
    if (!this.store.has(id)) {
      const decl = new AgeRatingDeclaration({
        id,
        affordances: { updateAgeRatingDeclaration: `/api/v1/age-rating-declarations/${id}` },
      });
      decl.setRepository(this);
      this.store.set(id, decl);
    }
    return this.store.get(id)!;
  }

  async update(declaration: AgeRatingDeclaration): Promise<void> {
    // Simulate persistence by re-anchoring the store entry to the current
    // instance — next `get(id)` returns the same object with fresh state.
    this.store.set(declaration.id, declaration);
  }
}
