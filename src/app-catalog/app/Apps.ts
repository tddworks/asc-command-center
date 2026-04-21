import type { App } from './App.ts';
import type { AppRepository } from './AppRepository.ts';

/**
 * Root aggregate for the App slice. Call sites construct an `Apps` with a
 * concrete `AppRepository` and navigate from there:
 *
 *   const apps = new Apps(repo);
 *   const all = await apps.list();
 *   const one = await apps.get('app-1');
 *   const builds = await one.loadBuilds();
 */
export class Apps {
  constructor(private readonly repo: AppRepository) {}

  list(): Promise<App[]> {
    return this.repo.list();
  }

  get(id: string): Promise<App> {
    return this.repo.get(id);
  }
}
