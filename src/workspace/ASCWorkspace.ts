import { makeAutoObservable, runInAction } from 'mobx';
import { App } from '../app-catalog/app/App.ts';
import { Apps } from '../app-catalog/app/Apps.ts';
import type { WorkspaceStore } from './WorkspaceStore.ts';
import type { AppRepository } from '../app-catalog/app/AppRepository.ts';

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

  /** Mutable so `switchMode` can swap the underlying repository without
   *  replacing the singleton — callers keep the same reference. */
  private appsRoot: Apps;

  constructor(
    appsRoot: Apps,
    private readonly store: WorkspaceStore,
  ) {
    this.appsRoot = appsRoot;
    makeAutoObservable(this, {}, { autoBind: true });
  }

  /** Swap the underlying repository (e.g. mock→rest toggle) and re-hydrate
   *  in place. Singleton consumers keep their reference; observer-wrapped
   *  components re-render when `apps` / `currentApp` mutate. */
  async switchMode(repo: AppRepository): Promise<void> {
    runInAction(() => {
      this.appsRoot = new Apps(repo);
      this.apps = [];
      this.currentApp = null;
      this.hydrated = false;
    });
    await this.hydrate();
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
