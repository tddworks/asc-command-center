import { makeAutoObservable, runInAction } from 'mobx';
import { InAppPurchase } from './InAppPurchase.ts';
import type { CreateInAppPurchaseInput, InAppPurchaseRepository } from './InAppPurchaseRepository.ts';

/**
 * Root aggregate for the IAP slice. Loads the IAPs of the workspace's
 * current app and owns the in-memory list the page reads — page calls
 * `iaps.refreshFor(appId)`, mutators delegate to the IAP itself.
 *
 * Mirrors `InstalledPlugins` (singleton + observable list + isLoading) so
 * the page can wrap in `observer()` and reflect mutations without a hook.
 */
export class InAppPurchases {
  repository: InAppPurchaseRepository;

  list: InAppPurchase[] = [];
  /** Last appId asked for. Used to skip stale refreshes triggered by
   *  rapid mode/account switches. */
  appId: string | null = null;

  isLoading = false;
  loaded = false;
  error: Error | null = null;

  constructor(repository: InAppPurchaseRepository) {
    this.repository = repository;
    makeAutoObservable(this, { repository: false });
  }

  // ── Display ──

  get count(): number { return this.list.length; }

  get pendingCount(): number {
    return this.list.filter((p) => p.isPendingReview).length;
  }

  get needsActionCount(): number {
    return this.list.filter((p) => !p.isApproved && p.isEditable).length;
  }

  // ── Mutators ──

  switchRepository(repo: InAppPurchaseRepository): void {
    this.repository = repo;
    this.list = [];
    this.appId = null;
    this.loaded = false;
    this.error = null;
  }

  /** Load IAPs for the given app. Replaces `list` on success. */
  async refreshFor(appId: string): Promise<void> {
    this.appId = appId;
    this.isLoading = true;
    this.error = null;
    try {
      const fetched = await this.repository.list(appId);
      runInAction(() => {
        // Drop the result if the caller has already moved to a different app.
        if (this.appId !== appId) return;
        this.list = fetched;
        this.loaded = true;
      });
    } catch (err) {
      runInAction(() => {
        this.error = err as Error;
        this.loaded = true;
      });
    } finally {
      runInAction(() => { this.isLoading = false; });
    }
  }

  async create(input: CreateInAppPurchaseInput): Promise<InAppPurchase> {
    const created = await this.repository.create(input);
    runInAction(() => { this.list = [...this.list, created]; });
    return created;
  }

  async remove(iap: InAppPurchase): Promise<void> {
    if (!iap.canDelete) {
      throw new Error(`IAP ${iap.id} cannot be deleted (no delete affordance)`);
    }
    await this.repository.remove(iap);
    runInAction(() => {
      this.list = this.list.filter((p) => p.id !== iap.id);
    });
  }

  // ── Lookups ──

  byId(id: string): InAppPurchase | undefined {
    return this.list.find((p) => p.id === id);
  }
}
