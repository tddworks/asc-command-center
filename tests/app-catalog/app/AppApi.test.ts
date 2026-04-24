import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RestAppRepository } from '../../../src/app-catalog/app/infrastructure/App.api.ts';
import { App } from '../../../src/app-catalog/app/App.ts';
import { Platform, VersionState } from '../../../src/release/version/Version.ts';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function stubBackend(extra: Partial<Record<string, (init: RequestInit | undefined) => Response | Promise<Response>>> = {}) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = typeof input === 'string' ? input : (input as URL).toString();
    if (extra[url]) return extra[url]!(init);
    return new Response('not stubbed: ' + url, { status: 404 });
  });
}

describe('RestAppRepository.createVersion', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  function makeApp(): App {
    return new App({
      id: 'app-9',
      name: 'Widget',
      bundleId: 'com.example.widget',
      sku: 'SKU',
      primaryLocale: 'en-US',
      isAvailableInNewTerritories: true,
      affordances: { createVersion: '/api/v1/apps/app-9/versions' },
    });
  }

  it('POSTs to the createVersion affordance with versionString + platform + copyright', async () => {
    let capturedInit: RequestInit | undefined;
    stubBackend({
      '/api/v1/apps/app-9/versions': (init) => {
        capturedInit = init;
        return jsonResponse({
          id: 'v-new',
          versionString: '3.0.0',
          platform: 'MAC_OS',
          state: VersionState.PrepareForSubmission,
          affordances: { updateVersion: '/api/v1/versions/v-new' },
        });
      },
    });
    const repo = new RestAppRepository();

    const v = await repo.createVersion(makeApp(), {
      platform: Platform.macOS,
      versionString: '3.0.0',
      copyright: '© 2026',
    });

    expect(capturedInit!.method).toBe('POST');
    expect(JSON.parse(capturedInit!.body as string)).toEqual({
      versionString: '3.0.0',
      platform: 'MAC_OS',
      copyright: '© 2026',
    });
    expect(v.id).toBe('v-new');
    expect(v.versionString).toBe('3.0.0');
    expect(v.canEdit).toBe(true);
    expect(v.repository).not.toBeNull();
  });

  it('sends null for copyright when the caller omits it', async () => {
    let capturedBody: unknown;
    stubBackend({
      '/api/v1/apps/app-9/versions': (init) => {
        capturedBody = JSON.parse(init!.body as string);
        return jsonResponse({ id: 'v-1', affordances: {} });
      },
    });
    const repo = new RestAppRepository();

    await repo.createVersion(makeApp(), { platform: Platform.iOS, versionString: '1.0.0' });

    expect((capturedBody as { copyright: unknown }).copyright).toBeNull();
  });

  it('accepts a wrapped { data: { id, ... } } response', async () => {
    stubBackend({
      '/api/v1/apps/app-9/versions': () =>
        jsonResponse({ data: { id: 'v-wrap', versionString: '4.0.0', affordances: {} } }),
    });
    const repo = new RestAppRepository();

    const v = await repo.createVersion(makeApp(), { platform: Platform.iOS, versionString: '4.0.0' });
    expect(v.id).toBe('v-wrap');
  });

  it('throws when the POST returns a non-OK status', async () => {
    stubBackend({
      '/api/v1/apps/app-9/versions': async () => new Response('nope', { status: 422 }),
    });
    const repo = new RestAppRepository();

    await expect(
      repo.createVersion(makeApp(), { platform: Platform.iOS, versionString: '1.0.0' }),
    ).rejects.toThrow(/422/);
  });

  it('throws when the response is missing an id', async () => {
    stubBackend({
      '/api/v1/apps/app-9/versions': () => jsonResponse({}),
    });
    const repo = new RestAppRepository();

    await expect(
      repo.createVersion(makeApp(), { platform: Platform.iOS, versionString: '1.0.0' }),
    ).rejects.toThrow(/no resource id was found/);
  });

  it('hydrates from the asc backend shape — { data: [ { _links, id, ... } ] }', async () => {
    stubBackend({
      '/api/v1/apps/app-9/versions': () =>
        jsonResponse({
          data: [
            {
              _links: {
                updateVersion:    { href: '/api/v1/versions/v-real', method: 'PATCH' },
                submitForReview:  { href: '/api/v1/versions/v-real/submit', method: 'POST' },
                listLocalizations:{ href: '/api/v1/versions/v-real/localizations', method: 'GET' },
              },
              appId: 'app-9',
              id: 'v-real',
              platform: 'MAC_OS',
              state: 'PREPARE_FOR_SUBMISSION',
              versionString: '1.0.0',
            },
          ],
        }),
    });
    const repo = new RestAppRepository();

    const v = await repo.createVersion(makeApp(), { platform: Platform.macOS, versionString: '1.0.0' });

    expect(v.id).toBe('v-real');
    expect(v.versionString).toBe('1.0.0');
    expect(v.platform).toBe('MAC_OS');
    // _links should have been flattened so the new Version is fully usable.
    expect(v.canEdit).toBe(true);
    expect(v.canSubmit).toBe(true);
    expect(v.affordances.updateVersion).toBe('/api/v1/versions/v-real');
  });

  it('hydrates from a JSON:API-shaped response (data.id + data.attributes)', async () => {
    stubBackend({
      '/api/v1/apps/app-9/versions': () =>
        jsonResponse({
          data: {
            id: 'v-jsonapi',
            type: 'appStoreVersions',
            attributes: { versionString: '5.0.0', platform: 'IOS' },
            affordances: { updateVersion: '/api/v1/versions/v-jsonapi' },
          },
        }),
    });
    const repo = new RestAppRepository();

    const v = await repo.createVersion(makeApp(), { platform: Platform.iOS, versionString: '5.0.0' });
    expect(v.id).toBe('v-jsonapi');
    expect(v.versionString).toBe('5.0.0');
    expect(v.canEdit).toBe(true);
  });

  it('follows the Location header when the body has no id', async () => {
    stubBackend({
      '/api/v1/apps/app-9/versions': () => new Response('', {
        status: 201,
        headers: { Location: '/api/v1/versions/v-followed' },
      }),
      '/api/v1/versions/v-followed': () =>
        jsonResponse({ data: { id: 'v-followed', versionString: '6.0.0', affordances: {} } }),
    });
    const repo = new RestAppRepository();

    const v = await repo.createVersion(makeApp(), { platform: Platform.iOS, versionString: '6.0.0' });
    expect(v.id).toBe('v-followed');
  });
});
