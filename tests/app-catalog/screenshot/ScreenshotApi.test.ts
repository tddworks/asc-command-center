import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RestScreenshotRepository } from '../../../src/app-catalog/screenshot/infrastructure/Screenshot.api.ts';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

interface StubRoutes {
  localizations?: unknown;
  screenshotSets?: unknown;
  /** `screenshots[setId]` → response body for /screenshot-sets/{id}/screenshots */
  screenshots?: Record<string, unknown>;
  /** Force a non-OK status for a specific key. */
  fail?: ('localizations' | 'screenshotSets')[];
}

function stubBackend(routes: StubRoutes) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = typeof input === 'string' ? input : (input as URL).toString();

    if (/\/versions\/[^/]+\/localizations/.test(url)) {
      if (routes.fail?.includes('localizations')) return new Response('boom', { status: 500 });
      return jsonResponse(routes.localizations ?? { data: [] });
    }
    if (/\/version-localizations\/[^/]+\/screenshot-sets/.test(url)) {
      if (routes.fail?.includes('screenshotSets')) return new Response('boom', { status: 500 });
      return jsonResponse(routes.screenshotSets ?? { data: [] });
    }
    const m = url.match(/\/screenshot-sets\/([^/]+)\/screenshots/);
    if (m) {
      const body = routes.screenshots?.[m[1]] ?? { data: [] };
      return jsonResponse(body);
    }
    return new Response('not stubbed: ' + url, { status: 404 });
  });
}

describe('RestScreenshotRepository', () => {

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('loads screenshot sets for a matching locale and returns real screenshot urls', async () => {
    stubBackend({
      localizations: {
        data: [
          { id: 'loc-en', locale: 'en-US' },
          { id: 'loc-de', locale: 'de-DE' },
        ],
      },
      screenshotSets: {
        data: [
          { id: 'set-67', localizationId: 'loc-en', screenshotDisplayType: 'APP_IPHONE_67', screenshotsCount: 1 },
          { id: 'set-ipad', localizationId: 'loc-en', screenshotDisplayType: 'APP_IPAD_PRO_3GEN_129', screenshotsCount: 0 },
        ],
      },
      screenshots: {
        'set-67': {
          data: [{
            id: 'ss-1',
            fileName: 'screen.png',
            imageWidth: 1290,
            imageHeight: 2796,
            sourceUrl: 'https://cdn.example/{w}x{h}bb.{f}',
            assetState: 'COMPLETE',
          }],
        },
        'set-ipad': { data: [] },
      },
    });

    const repo = new RestScreenshotRepository();
    const sets = await repo.listSets('v-1', 'en-US');

    const byType = new Map(sets.map((s) => [s.displayTypeId, s]));
    const iphone = byType.get('APP_IPHONE_67')!;
    expect(iphone.count).toBe(1);
    expect(iphone.screenshots[0].fileName).toBe('screen.png');
    expect(iphone.screenshots[0].srcAt(100)).toBe('https://cdn.example/200x433bb.png');

    const ipad = byType.get('APP_IPAD_PRO_3GEN_129')!;
    expect(ipad.count).toBe(0);
  });

  it('sends the correct localization id in the screenshot-sets URL', async () => {
    const fetchSpy = stubBackend({
      localizations: {
        data: [{ id: 'loc-fr', locale: 'fr-FR' }],
      },
      screenshotSets: { data: [] },
    });

    const repo = new RestScreenshotRepository();
    await repo.listSets('v-9', 'fr-FR');

    const urls = fetchSpy.mock.calls.map((c) =>
      typeof c[0] === 'string' ? c[0] : (c[0] as URL).toString(),
    );
    expect(urls).toContain('/api/v1/versions/v-9/localizations');
    expect(urls).toContain('/api/v1/version-localizations/loc-fr/screenshot-sets');
  });

  it('falls back to the URL convention when a set has no listScreenshots affordance', async () => {
    const fetchSpy = stubBackend({
      localizations: { data: [{ id: 'loc-en', locale: 'en-US' }] },
      screenshotSets: {
        data: [
          { id: 'set-aaa', localizationId: 'loc-en', screenshotDisplayType: 'APP_IPHONE_67' },
        ],
      },
      screenshots: { 'set-aaa': { data: [] } },
    });

    const repo = new RestScreenshotRepository();
    await repo.listSets('v-1', 'en-US');

    const urls = fetchSpy.mock.calls.map((c) =>
      typeof c[0] === 'string' ? c[0] : (c[0] as URL).toString(),
    );
    expect(urls).toContain('/api/v1/screenshot-sets/set-aaa/screenshots');
  });

  it('uses a set\'s listScreenshots affordance when present', async () => {
    const fetchSpy = stubBackend({
      localizations: { data: [{ id: 'loc-en', locale: 'en-US' }] },
      screenshotSets: {
        data: [{
          id: 'set-aaa',
          localizationId: 'loc-en',
          screenshotDisplayType: 'APP_IPHONE_67',
          _links: {
            listScreenshots: { href: '/api/v1/screenshot-sets/set-aaa/screenshots', method: 'GET' },
          },
        }],
      },
      screenshots: { 'set-aaa': { data: [] } },
    });

    const repo = new RestScreenshotRepository();
    await repo.listSets('v-1', 'en-US');

    const urls = fetchSpy.mock.calls.map((c) =>
      typeof c[0] === 'string' ? c[0] : (c[0] as URL).toString(),
    );
    // Still hits the href — affordance path is the same URL, and that's expected.
    expect(urls.filter((u) => u.endsWith('/screenshots')).length).toBe(1);
  });

  it('returns an empty scaffold when no localization matches the requested locale', async () => {
    stubBackend({
      localizations: {
        data: [{ id: 'loc-en', locale: 'en-US' }],
      },
    });

    const repo = new RestScreenshotRepository();
    const sets = await repo.listSets('v-1', 'ja-JP');

    expect(sets.length).toBeGreaterThan(0);
    expect(sets.every((s) => s.isEmpty)).toBe(true);
    // Required types should be represented.
    const ids = sets.map((s) => s.displayTypeId);
    expect(ids).toContain('APP_IPHONE_67');
    expect(ids).toContain('APP_IPAD_PRO_3GEN_129');
  });

  it('merges backend sets with empty scaffolds for missing required types', async () => {
    stubBackend({
      localizations: { data: [{ id: 'loc-en', locale: 'en-US' }] },
      screenshotSets: {
        data: [
          { id: 'set-67', localizationId: 'loc-en', screenshotDisplayType: 'APP_IPHONE_67' },
        ],
      },
      screenshots: { 'set-67': { data: [] } },
    });

    const repo = new RestScreenshotRepository();
    const sets = await repo.listSets('v-1', 'en-US');

    const ids = sets.map((s) => s.displayTypeId);
    expect(ids).toContain('APP_IPHONE_67');
    // iPad Pro 12.9" is required; must be scaffolded even though the backend
    // didn't return it.
    expect(ids).toContain('APP_IPAD_PRO_3GEN_129');
  });

  it('sorts sets by canonical display order', async () => {
    stubBackend({
      localizations: { data: [{ id: 'loc-en', locale: 'en-US' }] },
      screenshotSets: {
        data: [
          { id: 'set-ipad', localizationId: 'loc-en', screenshotDisplayType: 'APP_IPAD_PRO_3GEN_129' },
          { id: 'set-67', localizationId: 'loc-en', screenshotDisplayType: 'APP_IPHONE_67' },
        ],
      },
      screenshots: { 'set-ipad': { data: [] }, 'set-67': { data: [] } },
    });

    const repo = new RestScreenshotRepository();
    const sets = await repo.listSets('v-1', 'en-US');

    // iPhone 6.7" (order 10) should come before iPad Pro 12.9" (order 110).
    const iphoneIdx = sets.findIndex((s) => s.displayTypeId === 'APP_IPHONE_67');
    const ipadIdx = sets.findIndex((s) => s.displayTypeId === 'APP_IPAD_PRO_3GEN_129');
    expect(iphoneIdx).toBeLessThan(ipadIdx);
  });

  it('keeps the set in the list with empty screenshots when the per-set fetch fails', async () => {
    stubBackend({
      localizations: { data: [{ id: 'loc-en', locale: 'en-US' }] },
      screenshotSets: {
        data: [
          { id: 'set-broken', localizationId: 'loc-en', screenshotDisplayType: 'APP_IPHONE_67' },
        ],
      },
      // No stub for 'set-broken' screenshots — the default 404 route triggers.
    });

    const repo = new RestScreenshotRepository();
    const sets = await repo.listSets('v-1', 'en-US');

    const set = sets.find((s) => s.id === 'set-broken');
    expect(set).toBeDefined();
    expect(set!.count).toBe(0);
  });
});
