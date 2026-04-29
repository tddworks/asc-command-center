import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RestSubscriptionGroupRepository } from '../../../src/monetization/subscription/infrastructure/SubscriptionGroup.api.ts';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function stubBackend(
  extra: Partial<Record<string, (init: RequestInit | undefined) => Response | Promise<Response>>> = {},
) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = typeof input === 'string' ? input : (input as URL).toString();
    if (extra[url]) return extra[url]!(init);
    return new Response('not stubbed: ' + url, { status: 404 });
  });
}

describe('RestSubscriptionGroupRepository.create', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('hydrates from the asc backend shape — { data: [ { _links, id, referenceName } ] }', async () => {
    stubBackend({
      '/api/v1/apps/6760926018/subscription-groups': () =>
        jsonResponse({
          data: [
            {
              _links: {
                createLocalization:    { href: '/api/v1/subscription-groups/22058599/subscription-group-localizations', method: 'POST' },
                createSubscription:    { href: '/api/v1/subscription-groups/22058599/subscriptions', method: 'POST' },
                delete:                { href: '/api/v1/subscription-groups/22058599', method: 'DELETE' },
                listLocalizations:     { href: '/api/v1/subscription-groups/22058599/subscription-group-localizations', method: 'GET' },
                listSubscriptions:     { href: '/api/v1/subscription-groups/22058599/subscriptions', method: 'GET' },
                update:                { href: '/api/v1/subscription-groups/22058599', method: 'PATCH' },
              },
              appId: '6760926018',
              id: '22058599',
              referenceName: 'ASC CLI Subscriptions',
            },
          ],
        }),
    });
    const repo = new RestSubscriptionGroupRepository();

    const group = await repo.create({ appId: '6760926018', referenceName: 'ASC CLI Subscriptions' });

    expect(group.id).toBe('22058599');
    expect(group.appId).toBe('6760926018');
    expect(group.referenceName).toBe('ASC CLI Subscriptions');
    expect(group.canCreateSubscription).toBe(true);
    expect(group.canDelete).toBe(true);
    expect(group.canViewSubscriptions).toBe(true);
    expect(group.canViewGroupLocalizations).toBe(true);
    expect(group.repository).toBe(repo);
  });

  it('accepts the unwrapped { data: { ... } } shape too', async () => {
    stubBackend({
      '/api/v1/apps/app-1/subscription-groups': () =>
        jsonResponse({
          data: {
            _links: { delete: { href: '/api/v1/subscription-groups/sg-1', method: 'DELETE' } },
            appId: 'app-1',
            id: 'sg-1',
            referenceName: 'Pro Plans',
          },
        }),
    });
    const repo = new RestSubscriptionGroupRepository();

    const group = await repo.create({ appId: 'app-1', referenceName: 'Pro Plans' });

    expect(group.id).toBe('sg-1');
    expect(group.referenceName).toBe('Pro Plans');
    expect(group.canDelete).toBe(true);
  });
});
