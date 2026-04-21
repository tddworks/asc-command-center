import { makeAutoObservable, runInAction } from 'mobx';
import { App } from '../app/App.ts';
import type { Apps } from '../app/Apps.ts';
import type { WorkspaceStore } from './WorkspaceStore.ts';

/**
 * ASCWorkspace — session-level coordinator.
 *
 * Holds the set of apps the user has access to and the current focus
 * (`currentApp` → `currentApp.selectedVersion`). Not a business domain
 * concept of App Store Connect itself; exists because the web UI has a
 * list-and-switch flow that the Swift SDK (CLI, single-app per invocation)
 * does not need.
 *
 * Invariants:
 *   • `currentApp ∈ apps` or `null`
 *   • `currentApp.selectedVersion ∈ currentApp.versions` or `null`
 *     (enforced by App itself)
 */
export class ASCWorkspace {
  apps: App[] = [];
  currentApp: App | null = null;
  hydrated = false;

  constructor(
    private readonly appsRoot: Apps,
    private readonly store: WorkspaceStore,
  ) {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  /** Load all apps and restore the pinned focus. Call once on boot. */
  async hydrate(): Promise<void> {
    const list = await this.appsRoot.list();
    const pin = this.store.read();

    const target =
      (pin.appId && list.find((a) => a.id === pin.appId)) || list[0] || null;

    if (target) {
      await target.loadVersions();
      if (pin.versionId) {
        const pinned = target.versions.find((v) => v.id === pin.versionId);
        if (pinned) {
          runInAction(() => { target.selectedVersion = pinned; });
        }
      }
    }

    runInAction(() => {
      this.apps = list;
      this.currentApp = target;
      this.hydrated = true;
    });

    this.persist();
  }

  /** Switch focus to a different app. Loads its versions and picks a default. */
  async selectApp(id: string): Promise<void> {
    const app = this.apps.find((a) => a.id === id);
    if (!app) throw new Error(`Unknown app ${id}`);
    await app.loadVersions();
    runInAction(() => { this.currentApp = app; });
    this.persist();
  }

  /** Switch the selected version within the current app. */
  selectVersion(id: string): void {
    if (!this.currentApp) {
      throw new Error('No app is currently selected');
    }
    this.currentApp.selectVersion(id);
    this.persist();
  }

  private persist(): void {
    this.store.write({
      appId: this.currentApp?.id ?? null,
      versionId: this.currentApp?.selectedVersion?.id ?? null,
    });
  }
}
