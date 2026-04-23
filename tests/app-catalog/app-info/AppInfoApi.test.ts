import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RestAppInfoRepository } from '../../../src/app-catalog/app-info/infrastructure/AppInfo.api.ts';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Minimal REST backend stub for the default list/localizations path. */
function stubBackend(extra: Partial<Record<string, (init: RequestInit | undefined) => Response | Promise<Response>>> = {}) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = typeof input === 'string' ? input : (input as URL).toString();
    if (extra[url]) return extra[url]!(init);

    if (url.endsWith('/app-infos')) {
      return jsonResponse({
        data: [
          {
            _links: {
              listLocalizations: { href: '/api/v1/app-infos/info-42/localizations' },
              updateCategories:  { href: '/api/v1/app-infos/info-42' },
              createLocalization:{ href: '/api/v1/app-infos/info-42/localizations' },
            },
            id: 'info-42',
            appId: 'app-9',
            primaryCategoryId: 'FINANCE',
            secondaryCategoryId: null,
            contentRightsDeclaration: null,
            state: 'READY_FOR_DISTRIBUTION',
            appStoreState: 'READY_FOR_SALE',
          },
        ],
      });
    }

    if (url.endsWith('/localizations')) {
      return jsonResponse({
        data: [
          {
            _links: {
              update: { href: '/api/v1/app-info-localizations/loc-en' },
              delete: { href: '/api/v1/app-info-localizations/loc-en' },
            },
            id: 'loc-en',
            locale: 'en-US',
            name: 'Bakery',
            subtitle: 'Bread',
            privacyPolicyUrl: 'https://bakery.test/privacy',
            privacyChoicesUrl: null,
          },
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

  // ── list & hydrate ──

  it('list attaches itself as the repository on every returned AppInfo', async () => {
    stubBackend();
    const repo = new RestAppInfoRepository();

    const infos = await repo.list('app-9');

    expect(infos).toHaveLength(1);
    expect(infos[0].repository).toBe(repo);
  });

  it('list hydrates privacy URLs onto each localization', async () => {
    stubBackend();
    const repo = new RestAppInfoRepository();

    const [info] = await repo.list('app-9');

    const en = info.localizationFor('en-US')!;
    expect(en.privacyPolicyUrl).toBe('https://bakery.test/privacy');
    expect(en.canUpdate).toBe(true);
    expect(info.privacyPolicyUrl).toBe('https://bakery.test/privacy');
  });

  // ── saveCategories ──

  it('saveCategories PATCHes the updateCategories affordance with all category fields', async () => {
    let capturedInit: RequestInit | undefined;
    stubBackend({
      '/api/v1/app-infos/info-42': (init) => { capturedInit = init; return jsonResponse({}); },
    });
    const repo = new RestAppInfoRepository();

    const [info] = await repo.list('app-9');
    info.setPrimaryCategory('UTILITIES');
    info.setSecondaryCategory('PRODUCTIVITY');
    info.setContentRightsDeclaration('USES_THIRD_PARTY_CONTENT');

    await info.save();

    expect(capturedInit!.method).toBe('PATCH');
    expect(JSON.parse(capturedInit!.body as string)).toEqual({
      primaryCategoryId: 'UTILITIES',
      secondaryCategoryId: 'PRODUCTIVITY',
      contentRightsDeclaration: 'USES_THIRD_PARTY_CONTENT',
    });
    expect(info.hasUnsavedChanges).toBe(false);
  });

  it('saveCategories sends null for contentRightsDeclaration so it can be cleared', async () => {
    let capturedBody: unknown;
    stubBackend({
      '/api/v1/app-infos/info-42': (init) => {
        capturedBody = JSON.parse(init!.body as string);
        return jsonResponse({});
      },
    });
    const repo = new RestAppInfoRepository();

    const [info] = await repo.list('app-9');
    info.setContentRightsDeclaration('USES_THIRD_PARTY_CONTENT');
    await info.save();
    info.setContentRightsDeclaration(null);
    await info.save();

    expect((capturedBody as { contentRightsDeclaration: unknown }).contentRightsDeclaration).toBeNull();
  });

  it('save throws when the categories PATCH returns non-OK', async () => {
    stubBackend({
      '/api/v1/app-infos/info-42': async () => new Response('boom', { status: 500 }),
    });
    const repo = new RestAppInfoRepository();

    const [info] = await repo.list('app-9');
    info.setPrimaryCategory('UTILITIES');

    await expect(info.save()).rejects.toThrow(/500/);
    expect(info.hasUnsavedChanges).toBe(true);
  });

  // ── saveLocalization ──

  it('saveLocalization PATCHes the loc.update affordance with name + subtitle + privacy URLs', async () => {
    let capturedInit: RequestInit | undefined;
    stubBackend({
      '/api/v1/app-info-localizations/loc-en': (init) => {
        capturedInit = init; return jsonResponse({});
      },
    });
    const repo = new RestAppInfoRepository();

    const [info] = await repo.list('app-9');
    info.localizationFor('en-US')!.setName('Bakery 2');
    info.localizationFor('en-US')!.setSubtitle('More bread');
    info.setPrivacyPolicyUrl('https://bakery.test/privacy-v2');
    info.setPrivacyChoicesUrl('https://bakery.test/choices');

    await info.save();

    expect(capturedInit!.method).toBe('PATCH');
    expect(JSON.parse(capturedInit!.body as string)).toEqual({
      name: 'Bakery 2',
      subtitle: 'More bread',
      privacyPolicyUrl: 'https://bakery.test/privacy-v2',
      privacyChoicesUrl: 'https://bakery.test/choices',
    });
    expect(info.hasUnsavedChanges).toBe(false);
  });

  // ── createLocalization ──

  it('createLocalization POSTs to the createLocalization affordance and backfills the returned id', async () => {
    let capturedInit: RequestInit | undefined;
    stubBackend({
      '/api/v1/app-infos/info-42/localizations': (init) => {
        if (init?.method === 'POST') {
          capturedInit = init;
          return jsonResponse({ id: 'loc-fr-new' });
        }
        // GET during hydrate — return a real en-US row so the adapter does
        // not synthesize an empty primary-locale placeholder that would
        // itself be POSTed during save.
        return jsonResponse({
          data: [{ id: 'loc-en', locale: 'en-US', name: 'Bakery', subtitle: 'Bread' }],
        });
      },
    });
    const repo = new RestAppInfoRepository();

    const [info] = await repo.list('app-9');
    const added = info.addLocalization('fr-FR', { name: 'Boulangerie' });
    added.setSubtitle('Du pain frais');

    await info.save();

    expect(capturedInit!.method).toBe('POST');
    expect(JSON.parse(capturedInit!.body as string)).toEqual({
      locale: 'fr-FR',
      name: 'Boulangerie',
      subtitle: 'Du pain frais',
      privacyPolicyUrl: null,
      privacyChoicesUrl: null,
    });
    expect(added.id).toBe('loc-fr-new');
    expect(added.hasUnsavedChanges).toBe(false);
  });

  // ── deleteLocalization ──

  it('deleteLocalization DELETEs the loc.delete affordance', async () => {
    let capturedMethod: string | undefined;
    stubBackend({
      '/api/v1/app-info-localizations/loc-en': (init) => {
        capturedMethod = init!.method;
        return new Response(null, { status: 204 });
      },
    });
    const repo = new RestAppInfoRepository();

    const [info] = await repo.list('app-9');
    // en-US is the primary locale; swap primary so we can delete en-US.
    // Simpler: add another locale then remove en-US isn't allowed by UI but
    // domain permits it. We'll delete the single hydrated locale.
    info.removeLocalization('en-US');

    await info.save();

    expect(capturedMethod).toBe('DELETE');
  });
});
