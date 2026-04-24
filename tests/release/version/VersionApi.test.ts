import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RestVersionRepository } from '../../../src/release/version/infrastructure/VersionRepository.api.ts';
import { Version, VersionState, ReleaseType, Platform } from '../../../src/release/version/Version.ts';

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

describe('RestVersionRepository.save', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  function makeVersion(): Version {
    const v = new Version({
      id: 'v-42',
      appId: 'app-9',
      versionString: '2.0.0',
      state: VersionState.PrepareForSubmission,
      platform: Platform.iOS,
      affordances: { updateVersion: '/api/v1/versions/v-42' },
      copyright: null,
      releaseType: ReleaseType.Manual,
      earliestReleaseDate: null,
    });
    v.setRepository(new RestVersionRepository());
    return v;
  }

  it('PATCHes the updateVersion affordance with all top-level fields', async () => {
    let capturedInit: RequestInit | undefined;
    stubBackend({
      '/api/v1/versions/v-42': (init) => { capturedInit = init; return jsonResponse({}); },
    });

    const v = makeVersion();
    v.setVersionString('2.1.0');
    v.setCopyright('© 2026 Acme');
    v.setReleaseType(ReleaseType.AfterApproval);

    await v.save();

    expect(capturedInit!.method).toBe('PATCH');
    expect(JSON.parse(capturedInit!.body as string)).toEqual({
      versionString: '2.1.0',
      copyright: '© 2026 Acme',
      releaseType: ReleaseType.AfterApproval,
      earliestReleaseDate: null,
    });
    expect(v.hasUnsavedChanges).toBe(false);
  });

  it('sends null for copyright and earliestReleaseDate so they can be cleared', async () => {
    let capturedBody: { copyright: unknown; earliestReleaseDate: unknown } | undefined;
    stubBackend({
      '/api/v1/versions/v-42': (init) => {
        capturedBody = JSON.parse(init!.body as string);
        return jsonResponse({});
      },
    });

    const v = makeVersion();
    v.setCopyright('© 2025');
    await v.save();
    v.setCopyright(null);
    await v.save();

    expect(capturedBody!.copyright).toBeNull();
    expect(capturedBody!.earliestReleaseDate).toBeNull();
  });

  it('throws on non-OK and keeps the version dirty', async () => {
    stubBackend({
      '/api/v1/versions/v-42': async () => new Response('boom', { status: 500 }),
    });
    const v = makeVersion();
    v.setVersionString('2.1.0');

    await expect(v.save()).rejects.toThrow(/500/);
    expect(v.hasUnsavedChanges).toBe(true);
  });
});
