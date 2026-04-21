import type { ScreenshotRepository } from '../ScreenshotRepository.ts';
import type { ScreenshotSet } from '../ScreenshotSet.ts';
import { MockScreenshotRepository } from './Screenshot.mock.ts';
import type { DataMode } from '../../../shared/api-client.tsx';

/**
 * REST adapter for screenshot sets. Backend endpoints aren't confirmed yet
 * — delegates to the mock store with a one-time `console.warn` so real
 * apps still see something useful until we can wire the real list call.
 *
 * When the backend surfaces a `listScreenshotSets` affordance on
 * AppStoreVersionLocalization (or a top-level endpoint), replace the
 * `listSets` body with the real `apiClient.get(...)` call.
 */
export class RestScreenshotRepository implements ScreenshotRepository {
  private readonly fallback = new MockScreenshotRepository();
  private warned = false;

  async listSets(versionId: string, locale: string): Promise<ScreenshotSet[]> {
    if (!this.warned) {
      console.warn(
        '[Screenshots] backend list endpoint not wired yet — using in-memory demo sets.',
      );
      this.warned = true;
    }
    return this.fallback.listSets(versionId, locale);
  }
}

export async function screenshotRepositoryFor(mode: DataMode): Promise<ScreenshotRepository> {
  if (mode === 'mock') return new MockScreenshotRepository();
  return new RestScreenshotRepository();
}
