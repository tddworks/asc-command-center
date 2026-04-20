# Feature slice playbook

How to build a new feature in this codebase — the canonical **cake-slice (vertical slice)** pattern with a **rich domain model**, **repository ports**, and **Chicago-school TDD**. The `src/app/` slice is the reference implementation; mirror it when you add or migrate a feature.

## When to use this playbook

- Adding a new domain area (e.g. a new `screenshot/` or `appinfo/` slice).
- Migrating one of the legacy slices (`build/`, `version/`, `testflight/`, `iap/`, `code-signing/`, …) from the old `fetchX(appId, mode)` shape to the repository shape.
- Extending an existing rich-domain slice with a new navigation method.

Out of scope: shared UI (`src/shared/`), plugin system (`src/plugin/`), styling. Those have different rules.

## The shape at a glance

```
src/<feature>/
  <Feature>.ts                   # Domain class — state, behavior, navigation
  <Feature>Repository.ts         # Port — interface the domain depends on
  <Features>.ts                  # Root aggregate — wraps the repository
  <Feature>.hooks.ts             # React hooks — build aggregate + delegate
  infrastructure/
    <Feature>.api.ts             # Rest<Feature>Repository + repositoryFor(mode)
    <Feature>.mock.ts            # Mock<Feature>Repository with fixtures
  pages/<Feature>Page.tsx        # Route-level UI (lazy-loaded in src/App.tsx)
  components/                    # Leaf UI for this slice

tests/<feature>/
  <Feature>.test.ts              # Domain unit tests (state-based)
  <Features>.test.ts             # Aggregate unit tests
  <Feature>Card.test.tsx         # Optional UI tests
```

## Layer rules

| Layer            | May import                                                | Must not import                          |
|------------------|-----------------------------------------------------------|------------------------------------------|
| Domain (`Feature.ts`, `Features.ts`) | Another slice's **domain class** only          | `infrastructure/`, `pages/`, `react`     |
| Port (`FeatureRepository.ts`)        | The domain class(es) it returns                | Any concrete infrastructure              |
| Infrastructure (`infrastructure/*`)  | Domain + `shared/api-client`                   | `pages/`, `components/`, `react`         |
| Application (`.hooks.ts`)            | Domain + aggregate + `repositoryFor`           | Other slices' `infrastructure/`          |
| UI (`pages/`, `components/`)         | Domain via props or hooks                      | `infrastructure/` directly, `apiClient`  |

If a rule feels inconvenient, that's the signal the design is off — don't break the rule, rethink the split.

## Step-by-step

### 1. Domain class (`<Feature>.ts`)

A rich domain class, not a DTO. Readonly fields + behaviour. Pure except for navigation methods that delegate to the repository.

```ts
// src/widget/Widget.ts
import type { Affordances } from '../shared/types.ts';
import type { WidgetRepository } from './WidgetRepository.ts';
import type { Gizmo } from '../gizmo/Gizmo.ts';

export class Widget {
  constructor(
    readonly id: string,
    readonly name: string,
    readonly state: WidgetState,
    readonly affordances: Affordances,
    private readonly repo?: WidgetRepository,
  ) {}

  // ── Semantic booleans ──
  get isActive(): boolean { return this.state === WidgetState.Active; }

  // ── Capability checks ──
  get canViewGizmos(): boolean { return 'getGizmos' in this.affordances; }

  // ── Navigation ──
  async loadGizmos(): Promise<Gizmo[]> {
    if (!this.canViewGizmos) return [];
    return this.requireRepo().gizmos(this);
  }

  // ── Repo plumbing ──
  withRepository(repo: WidgetRepository): Widget {
    return new Widget(this.id, this.name, this.state, this.affordances, repo);
  }
  private requireRepo(): WidgetRepository {
    if (!this.repo) throw new Error(`Widget ${this.id} has no repository attached`);
    return this.repo;
  }

  // ── Factory ──
  static fromJSON(json: Record<string, unknown>, repo?: WidgetRepository): Widget {
    return new Widget(
      json.id as string,
      (json.name as string) ?? '',
      (json.state as WidgetState) ?? WidgetState.Inactive,
      (json.affordances as Affordances) ?? {},
      repo,
    );
  }
}
```

**Rules:**
- Readonly fields. No setters. `repo` is `private readonly`.
- `fromJSON` accepts alternate field names (`version ?? buildNumber ?? ''`). Permissive input, canonical output.
- Navigation methods gate on the matching capability and return `[]` / domain defaults when absent. Never throw for missing capability — throw only when the repo is missing entirely.
- No React, no `fetch`, no `apiClient` imports here.

### 2. Repository port (`<Feature>Repository.ts`)

A single interface — the slice's only dependency on infrastructure. Name methods in domain terms (`gizmos(widget)`, not `fetchGizmosByWidgetId`).

```ts
// src/widget/WidgetRepository.ts
import type { Widget } from './Widget.ts';
import type { Gizmo } from '../gizmo/Gizmo.ts';

export interface WidgetRepository {
  list(): Promise<Widget[]>;
  get(id: string): Promise<Widget>;
  gizmos(widget: Widget): Promise<Gizmo[]>;
}
```

### 3. Root aggregate (`<Features>.ts`)

Plural name. One per slice. Wraps the repository and exposes entry-point operations. Navigation from a loaded entity goes through the entity's own methods, not back through the root.

```ts
// src/widget/Widgets.ts
import type { Widget } from './Widget.ts';
import type { WidgetRepository } from './WidgetRepository.ts';

export class Widgets {
  constructor(private readonly repo: WidgetRepository) {}
  list(): Promise<Widget[]>    { return this.repo.list(); }
  get(id: string): Promise<Widget> { return this.repo.get(id); }
}
```

### 4. Infrastructure (`infrastructure/<Feature>.api.ts` + `.mock.ts`)

Two concrete `WidgetRepository` implementations plus a factory. The mock attaches `this` to every hydrated domain object so navigation works end-to-end in mock mode.

```ts
// src/widget/infrastructure/Widget.api.ts
import { Widget } from '../Widget.ts';
import { Gizmo } from '../../gizmo/Gizmo.ts';
import { apiClient, type DataMode } from '../../shared/api-client.tsx';
import type { WidgetRepository } from '../WidgetRepository.ts';

export class RestWidgetRepository implements WidgetRepository {
  async list() {
    const json = await apiClient.get<{ data: Record<string, unknown>[] }>('/api/v1/widgets');
    return json.data.map((row) => Widget.fromJSON(row, this));
  }
  async get(id: string) {
    const json = await apiClient.get<{ data: Record<string, unknown> }>(`/api/v1/widgets/${id}`);
    return Widget.fromJSON(json.data, this);
  }
  async gizmos(widget: Widget) {
    const json = await apiClient.get<{ data: Record<string, unknown>[] }>(`/api/v1/widgets/${widget.id}/gizmos`);
    return json.data.map(Gizmo.fromJSON);
  }
}

export async function repositoryFor(mode: DataMode): Promise<WidgetRepository> {
  if (mode === 'mock') {
    const { MockWidgetRepository } = await import('./Widget.mock.ts');
    return new MockWidgetRepository();
  }
  return new RestWidgetRepository();
}
```

```ts
// src/widget/infrastructure/Widget.mock.ts
import { Widget, WidgetState } from '../Widget.ts';
import type { WidgetRepository } from '../WidgetRepository.ts';
import { Gizmo } from '../../gizmo/Gizmo.ts';

export class MockWidgetRepository implements WidgetRepository {
  async list() { return this.fixtures(); }
  async get(id: string) {
    const found = this.fixtures().find(w => w.id === id);
    if (!found) throw new Error(`Widget ${id} not found`);
    return found;
  }
  async gizmos(_widget: Widget) { return [/* mock gizmos */]; }

  private fixtures(): Widget[] {
    return [
      new Widget('w-1', 'Alpha', WidgetState.Active, { getGizmos: 'asc gizmos list --widget-id w-1' }, this),
    ];
  }
}
```

### 5. Application hook (`<Feature>.hooks.ts`)

Thin. Builds the aggregate from `useDataMode()` and delegates. Uses a cancellation flag because `repositoryFor` is async.

```ts
// src/widget/Widget.hooks.ts
import { useEffect, useState } from 'react';
import { Widget } from './Widget.ts';
import { Widgets } from './Widgets.ts';
import { repositoryFor } from './infrastructure/Widget.api.ts';
import { useDataMode } from '../shared/api-client.tsx';

export function useWidgets() {
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const mode = useDataMode();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    repositoryFor(mode)
      .then(repo => new Widgets(repo).list())
      .then(list => { if (!cancelled) setWidgets(list); })
      .catch(e => { if (!cancelled) setError(e); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [mode]);

  return { widgets, loading, error };
}
```

### 6. UI (`pages/` + `components/`)

Components consume the domain class through props or hooks. **No infrastructure imports, no affordance string-keys, no fetch.** Button disabled states read `widget.canX`. Lists call `widget.loadGizmos()` through an effect.

### 7. Tests — Chicago-school with `vi.fn()` stubs

Use native Vitest mocking. A shared `stubRepo()` helper keeps tests terse.

```ts
// tests/widget/Widget.test.ts
import { describe, it, expect, vi } from 'vitest';
import { Widget, WidgetState } from '../../src/widget/Widget.ts';
import type { WidgetRepository } from '../../src/widget/WidgetRepository.ts';

function stubRepo(overrides: Partial<WidgetRepository> = {}): WidgetRepository {
  return { list: vi.fn(), get: vi.fn(), gizmos: vi.fn(), ...overrides };
}

describe('Widget', () => {
  it('loadGizmos delegates to repository', async () => {
    const expected = [/* mock gizmo */];
    const repo = stubRepo({ gizmos: vi.fn().mockResolvedValue(expected) });
    const w = new Widget('w-1', 'Alpha', WidgetState.Active, { getGizmos: '...' }, undefined)
      .withRepository(repo);

    await expect(w.loadGizmos()).resolves.toEqual(expected);
    expect(repo.gizmos).toHaveBeenCalledWith(w);
  });

  it('loadGizmos short-circuits to empty when affordance missing', async () => {
    const repo = stubRepo({ gizmos: vi.fn() });
    const w = new Widget('w-1', 'Alpha', WidgetState.Active, {}, repo);

    await expect(w.loadGizmos()).resolves.toEqual([]);
    expect(repo.gizmos).not.toHaveBeenCalled();
  });

  it('loadGizmos throws when no repository attached', async () => {
    const w = new Widget('w-1', 'Alpha', WidgetState.Active, { getGizmos: '...' });
    await expect(w.loadGizmos()).rejects.toThrow(/no repository attached/);
  });
});
```

**Conventions:**
- Primary assertion is on the **returned value**; `toHaveBeenCalledWith` / `not.toHaveBeenCalled` are supporting evidence of intent ("the repo should/shouldn't be hit").
- Never mock the domain class; never assert call sequences.
- Group tests by member kind: semantic booleans → capability checks → navigation → `fromJSON` hydration.
- Don't reach for `ts-mockito` / `vitest-mock-extended`. Plain objects + `vi.fn()` are enough and match the Vitest docs.

### 8. Wire the page route

Add a `lazy(() => import('./<feature>/pages/<Feature>Page.tsx'))` in `src/App.tsx` and a `<Route>` entry.

## Checklist — new slice ready to merge

- [ ] `<Feature>.ts` with semantic booleans, capability checks, navigation methods, `fromJSON(json, repo?)`.
- [ ] `<Feature>Repository.ts` port.
- [ ] `<Features>.ts` root aggregate.
- [ ] `infrastructure/<Feature>.api.ts` with `Rest<Feature>Repository` + `repositoryFor(mode)`.
- [ ] `infrastructure/<Feature>.mock.ts` with `Mock<Feature>Repository` — fixtures pass `this` into every `new <Feature>(...)` so navigation works in mock mode.
- [ ] `<Feature>.hooks.ts` using cancellation flag.
- [ ] `pages/<Feature>Page.tsx` + a `<Route>` in `src/App.tsx`.
- [ ] Tests grouped by member kind; uses `stubRepo()` + `vi.fn()`; no mocks of the domain class.
- [ ] `npx vitest run tests/<feature>` green.
- [ ] `npx tsc -b --noEmit` clean.

## Migrating a legacy slice

Legacy slices export `fetch<Feature>(appId, mode)` and construct plain domain objects. To migrate:

1. Introduce `<Feature>Repository.ts` + `<Features>.ts` alongside the existing files.
2. Add a `private readonly repo?` field to the domain class and any navigation methods you need. Keep the old constructor signature backward-compatible (repo is optional, placed last).
3. Replace `fetch<Feature>` with `Rest<Feature>Repository` + `Mock<Feature>Repository`; add `repositoryFor(mode)`.
4. Update the hook to use `new <Features>(await repositoryFor(mode))`.
5. Find every external caller (`grep -r 'fetch<Feature>'`) and migrate them. Often just `src/dashboard/Dashboard.hooks.ts`.
6. Keep or delete the old free functions based on caller audit. Don't keep dead code "for compatibility."
7. Tests: existing value-object tests keep working because `repo` is optional. Add new tests for navigation (delegates / short-circuits / throws) and for the root aggregate.

See commit history on `src/app/` for a concrete before/after.
