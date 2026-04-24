import { App } from '../App.ts';
import { Build } from '../../../release/build/Build.ts';
import { Version, type NewVersionInit } from '../../../release/version/Version.ts';
import { RestVersionRepository } from '../../../release/version/infrastructure/VersionRepository.api.ts';
import { apiClient, normalizeLinks, type DataMode } from '../../../shared/api-client.tsx';
import type { AppRepository } from '../AppRepository.ts';

export class RestAppRepository implements AppRepository {
  /** Keep one instance so a Version created via `createVersion` shares a
   *  repository with Versions returned from `versions()` — the aggregate
   *  pushes the new Version into `app.versions` and the UI expects both to
   *  navigate through the same repo. */
  private readonly versionRepo = new RestVersionRepository();

  async list(): Promise<App[]> {
    // ?include=icon enriches each row with `iconAsset: { templateUrl, ... }`
    // so AppIcon renders real Apple CDN icons without a second request.
    const json = await apiClient.get<{ data: Record<string, unknown>[] }>('/api/v1/apps?include=icon');
    return json.data.map((row) => App.fromJSON(row, this));
  }

  async get(id: string): Promise<App> {
    const json = await apiClient.get<{ data: Record<string, unknown> }>(`/api/v1/apps/${id}?include=icon`);
    // Single-resource endpoints return `data` as an object OR a one-item array.
    const row = Array.isArray(json.data) ? (json.data as Record<string, unknown>[])[0] : json.data;
    return App.fromJSON(row ?? {}, this);
  }

  async builds(app: App): Promise<Build[]> {
    const json = await apiClient.get<{ data: Record<string, unknown>[] }>(
      `/api/v1/apps/${app.id}/builds`,
    );
    return json.data.map(Build.fromJSON);
  }

  async versions(app: App): Promise<Version[]> {
    const json = await apiClient.get<{ data: Record<string, unknown>[] }>(
      `/api/v1/apps/${app.id}/versions`,
    );
    return json.data.map((row) => {
      const v = Version.fromJSON(row);
      v.setRepository(this.versionRepo);
      return v;
    });
  }

  async createVersion(app: App, init: NewVersionInit): Promise<Version> {
    const url = app.affordances.createVersion;
    if (!url) {
      // Shouldn't happen — App.createVersion gates on canCreateVersion — but
      // surface loudly if it does so the missing affordance doesn't hide.
      throw new Error(`App ${app.id} has no createVersion affordance`);
    }
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        versionString: init.versionString,
        platform: init.platform,
        copyright: init.copyright ?? null,
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`POST ${url} failed: ${res.status} ${text}`);
    }

    // Some backends return 201 + Location header with no body, some return a
    // bare resource, some wrap in `{ data: ... }`, some are JSON:API with
    // `{ data: { id, type, attributes: {...} } }`. Probe each shape, and if
    // we still can't find an id, follow the Location header.
    const raw = await res.text();
    const row = pickResource(raw);
    if (row) {
      const v = Version.fromJSON({ ...row, appId: row.appId ?? app.id });
      v.setRepository(this.versionRepo);
      return v;
    }

    const location = res.headers.get('location') ?? res.headers.get('Location');
    if (location) {
      const followed = await apiClient.get<{ data: Record<string, unknown> }>(location);
      const followedRow = (followed.data ?? followed) as Record<string, unknown>;
      const v = Version.fromJSON({ ...followedRow, appId: followedRow.appId ?? app.id });
      v.setRepository(this.versionRepo);
      return v;
    }

    throw new Error(
      `POST ${url} returned ${res.status} but no resource id was found ` +
      `in the response body or Location header. Body was: ${raw.slice(0, 500)}`,
    );
  }
}

/**
 * Pull a `{ id, ...attrs }` resource out of common response shapes:
 *   - bare:        { id, versionString, ... }
 *   - wrapped:     { data: { id, versionString, ... } }
 *   - JSON:API:    { data: { id, type, attributes: { versionString, ... } } }
 * Returns null if no id can be located.
 */
function pickResource(raw: string): Record<string, unknown> | null {
  if (!raw) return null;
  let json: unknown;
  try { json = JSON.parse(raw); } catch { return null; }
  if (!json || typeof json !== 'object') return null;

  // Run the same `_links → affordances` flattening that `apiClient.get`
  // applies. Without this, raw fetch responses leave `_links` on the row
  // and the resulting Version has no affordances → can't update or submit.
  const normalized = normalizeLinks(json) as Record<string, unknown>;

  // Bare.
  if (typeof normalized.id === 'string') return normalized;

  // Wrapped — could be a single resource or an array; createVersion returns
  // one row even when the backend wraps it as `{ data: [ {...} ] }`.
  const data = normalized.data;
  if (data && typeof data === 'object') {
    const dataObj = (Array.isArray(data) ? data[0] : data) as Record<string, unknown>;
    if (dataObj && typeof dataObj.id === 'string') {
      // JSON:API: hoist `attributes` so Version.fromJSON sees fields at the
      // same level as `id`. Other shapes already have everything flat.
      const attributes = dataObj.attributes;
      if (attributes && typeof attributes === 'object') {
        return {
          ...(attributes as Record<string, unknown>),
          id: dataObj.id,
          affordances: dataObj.affordances,
        };
      }
      return dataObj;
    }
  }
  return null;
}

/** Resolve the AppRepository implementation for the current data mode. */
export async function repositoryFor(mode: DataMode): Promise<AppRepository> {
  if (mode === 'mock') {
    const { MockAppRepository } = await import('./App.mock.ts');
    return new MockAppRepository();
  }
  return new RestAppRepository();
}
