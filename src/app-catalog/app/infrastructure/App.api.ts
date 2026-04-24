import { App } from '../App.ts';
import { Build } from '../../../release/build/Build.ts';
import { Version, type NewVersionInit } from '../../../release/version/Version.ts';
import { RestVersionRepository } from '../../../release/version/infrastructure/VersionRepository.api.ts';
import { apiClient, type DataMode } from '../../../shared/api-client.tsx';
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
    const json = (await res.json().catch(() => null)) as
      | { data?: Record<string, unknown>; id?: string; versionString?: string }
      | null;
    // Accept either a bare resource ({ id, ... }) or a wrapped one ({ data: {...} }).
    const row = (json?.data ?? json) as Record<string, unknown> | null;
    if (!row || !row.id) throw new Error(`POST ${url} did not return an id`);
    const v = Version.fromJSON({ ...row, appId: row.appId ?? app.id });
    v.setRepository(this.versionRepo);
    return v;
  }
}

/** Resolve the AppRepository implementation for the current data mode. */
export async function repositoryFor(mode: DataMode): Promise<AppRepository> {
  if (mode === 'mock') {
    const { MockAppRepository } = await import('./App.mock.ts');
    return new MockAppRepository();
  }
  return new RestAppRepository();
}
