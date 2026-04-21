import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RestAppInfoRepository } from '../../../src/app-catalog/app-info/infrastructure/AppInfo.api.ts';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Mock the REST endpoints a typical AppInfo flow touches. */
function stubBackend(extra: Partial<Record<string, (init: RequestInit | undefined) => Response | Promise<Response>>> = {}) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = typeof input === 'string' ? input : (input as URL).toString();

    if (extra[url]) return extra[url]!(init);

    // Default: a single AppInfo row with a PATCH affordance.
    if (url.endsWith('/app-infos')) {
      return jsonResponse({
        data: [
          {
            _links: {
              listLocalizations: {
                href: '/api/v1/app-infos/info-42/localizations',
                method: 'GET',
              },
              updateCategories: {
                href: '/api/v1/app-infos/info-42',
                method: 'PATCH',
              },
            },
            id: 'info-42',
            appId: 'app-9',
            primaryCategoryId: 'FINANCE',
            secondaryCategoryId: null,
            state: 'READY_FOR_DISTRIBUTION',
            appStoreState: 'READY_FOR_SALE',
          },
        ],
      });
    }

    if (url.endsWith('/localizations')) {
      return jsonResponse({
        data: [
          { id: 'loc-en', locale: 'en-US', name: 'Bakery', subtitle: 'Bread' },
        ],
      });
    }

    return new Response('not stubbed: ' + url, { status: 404 });
  });
}

describe('RestAppInfoRepository', () => {

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('list attaches itself as the repository on every returned AppInfo', async () => {
    stubBackend();
    const repo = new RestAppInfoRepository();

    const infos = await repo.list('app-9');

    expect(infos).toHaveLength(1);
    expect(infos[0].repository).toBe(repo);
  });

  it('save issues a PATCH to the updateCategories affordance with the current fields', async () => {
    let capturedInit: RequestInit | undefined;
    stubBackend({
      '/api/v1/app-infos/info-42': (init) => {
        capturedInit = init;
        return jsonResponse({});
      },
    });
    const repo = new RestAppInfoRepository();

    const [info] = await repo.list('app-9');
    info.setPrimaryCategory('UTILITIES');
    info.setSecondaryCategory('PRODUCTIVITY');
    info.setContentRightsDeclaration('USES_THIRD_PARTY_CONTENT');

    await info.save();

    expect(capturedInit).toBeDefined();
    expect(capturedInit!.method).toBe('PATCH');
    expect(JSON.parse(capturedInit!.body as string)).toEqual({
      primaryCategoryId: 'UTILITIES',
      secondaryCategoryId: 'PRODUCTIVITY',
      contentRightsDeclaration: 'USES_THIRD_PARTY_CONTENT',
    });
    expect(info.hasUnsavedChanges).toBe(false);
  });

  it('save throws when the backend returns a non-OK status', async () => {
    stubBackend({
      '/api/v1/app-infos/info-42': async () => new Response('boom', { status: 500 }),
    });
    const repo = new RestAppInfoRepository();

    const [info] = await repo.list('app-9');
    info.setPrimaryCategory('UTILITIES');

    await expect(info.save()).rejects.toThrow(/500/);
    // Still dirty — caller can retry.
    expect(info.hasUnsavedChanges).toBe(true);
  });
});
