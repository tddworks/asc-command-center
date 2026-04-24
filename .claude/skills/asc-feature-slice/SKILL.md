---
name: asc-feature-slice
description: |
  Build or extend a feature in the asc-command-center React SPA using the canonical cake-slice: rich mutable MobX domain class, repository port, root aggregate, application hooks, REST + mock infrastructure, and pages/components — driven Chicago-school TDD with state-based Vitest specs. Use this skill whenever the user asks to add, scaffold, extend, or migrate anything in `src/<context>/<feature>/`, including: "add a new feature", "new slice", "add a page for X", "build a Y view", "add an endpoint/resource to the UI", "migrate Z to the repository shape", "where should X live", "wire up the App Store Connect resource X", "scaffold the <feature> module", or any addition that cuts through domain + infrastructure + UI. ALSO trigger on questions like "how do I structure this feature", "what's the pattern for a new slice", or when the user starts writing code that looks like it belongs in this repo's `src/` tree. If the feature being requested cannot be decomposed into the canonical components below, that is the signal the *architecture* is wrong — raise the concern before writing code.
---

# asc-command-center feature slice

The asc-command-center is a React 19 + Vite SPA over the `asc` App Store Connect CLI, built around **rich mutable domain classes with MobX**, **HATEOAS affordances**, **Chicago-school state-based TDD**, and **vertical cake-slices**. Every feature — an App Info editor, a Screenshot set picker, a TestFlight group view — cuts through all layers in one self-contained folder.

This skill enforces that shape. Read the authoritative docs before making decisions:

- **`CLAUDE.md`** — the rules at a glance (layering, imports, observability, affordances).
- **`docs/features/README.md`** — the step-by-step playbook with worked examples.

Then build the feature using the shape below. Treat this file as the checklist; reach for the two docs above for any "why" question.

## The litmus test

Before writing code, say out loud what the feature is and decompose it into the six canonical components. **If any component is missing, unclear, or would require squeezing into the wrong layer, that is the signal that the architecture is wrong — not the pattern.** Stop and raise the concern with the user. Don't paper over a bad fit with a helper, a top-level field, or a "just for now" shortcut: those become permanent and poison future slices.

Typical symptoms that the fit is wrong:

- A field can't decide whether it lives on the aggregate or the localization.
- A "save" needs to touch two resources through different endpoints with no shared affordance.
- The domain class starts wanting to know about HTTP, JSON shapes, or React state.
- A test needs to mock the domain class itself (instead of the repository port).
- Two features want to share `infrastructure/` files.

Each of these means the decomposition is wrong. Rethink the split.

## The six canonical components

For `src/<context>/<feature>/`, always produce:

### 1. Domain class — `<Feature>.ts`

Rich, mutable, **MobX-observable** (`makeAutoObservable(this)` in the constructor). Fields are `var` (mutable). The class exposes five kinds of members:

- **Semantic booleans** — `isUsable`, `isValid`, `isLive` named for intent, not raw enum values.
- **Capability checks** — `canAddToTestFlight → 'addToTestFlight' in this.affordances`. Gate UI actions on what the backend says is allowed.
- **Display getters** — `statusLabel`, `statusTone`, `displayName`. Pure mappings over state.
- **Navigation mutators** — `async loadVersions()`, `selectVersion(id)`. Gate on capability, delegate to `this.repository.<method>(this)`, mutate fields in place. Wrap post-`await` mutations in `runInAction(...)`. Short-circuit to `[]` when the affordance is absent; throw only if the repo is missing entirely.
- **`static fromJSON(json, repo?)`** — the **only** hydration path. Permissive on input (`json.version ?? json.buildNumber`), canonical on output. Threads the repo so hydrated objects can navigate.

Constructor takes a single `<Feature>Init` interface (options object, never positional args). Aggregate stores its repository reference via `setRepository(repo)` or through the factory.

**No DTO interfaces.** `fromJSON(json: Record<string, unknown>)` with narrow casts inside the factory is the rule. Any parallel "backend shape" type is a smell — the domain owns its hydration contract.

### 2. Repository port — `<Feature>Repository.ts`

A single TypeScript `interface` naming methods in **domain terms**: `versions(app)`, not `fetchVersionsByAppId(id)`. For aggregates with mutable state, split save into the resource-granular methods the REST endpoints actually expose (`saveCategories`, `saveLocalization`, `createLocalization`, `deleteLocalization`), so each method mirrors one real HTTP call. The aggregate's `save()` orchestrates these.

### 3. Root aggregate — `<Features>.ts` (plural)

Thin wrapper over the port. Exposes entry points (`list`, `get`). Navigation from a loaded entity goes through the entity's own methods, not back through the root.

### 4. Application hook — `<Feature>.hooks.ts`

Builds `new <Features>(await repositoryFor(mode))` from `useDataMode()` and delegates. Uses a `cancelled` flag because `repositoryFor` is async. **Don't fetch from components.** Always go through the slice's hook.

### 5. Infrastructure — `infrastructure/<Feature>.api.ts` + `.mock.ts`

Two concrete repositories plus the `repositoryFor(mode)` factory:

- `Rest<Feature>Repository` — calls through `apiClient.get/post` (which runs `normalizeLinks` to flatten `_links.action.href` into flat `affordances`). Follows affordance URLs, never hand-builds endpoint strings past the entry point.
- `Mock<Feature>Repository` — deterministic fixtures, attaches `this` to every hydrated domain object so navigation works end-to-end in mock mode. Affordance values are HATEOAS hrefs identical in shape to REST — mock and REST are behaviourally identical.

### 6. UI — `pages/<Feature>Page.tsx` + `components/`

Route-level pages are `React.lazy`-imported in `src/App.tsx`. Any component that reads observable domain state is wrapped in `observer(Component)` from `mobx-react-lite`. Templates call `appInfo.canX` / `version.statusLabel` / `build.isUsable` directly. **Components never import `infrastructure/`, `apiClient`, or string affordance keys.**

## TDD loop — red → green → refactor, per behavior

For each member above, write a failing test first. Group by kind: semantic booleans, capability checks, display getters, navigation mutators, `fromJSON`. Use **native Vitest mocking**:

```ts
function stubRepo(overrides: Partial<WidgetRepository> = {}): WidgetRepository {
  return { list: vi.fn(), get: vi.fn(), widgets: vi.fn(), ...overrides };
}
```

**Chicago-school conventions** the codebase enforces:

- Construct the real domain object. Pass a plain-object repo whose methods are `vi.fn().mockResolvedValue(...)`.
- Call the mutator. Assert on the **mutated state** (primary). Add `toHaveBeenCalledWith(...)` / `not.toHaveBeenCalled()` as supporting evidence of intent.
- Never mock the domain class. Never assert call sequences. Never reach for `ts-mockito` / `vitest-mock-extended` — plain objects + `vi.fn()` are enough.
- Hooks and infra are integration-covered through page tests when needed, not unit-tested.

## Before writing any code

Answer these out loud with the user — they are the architectural litmus test:

1. **Which bounded context?** (App Catalog / Release / Monetization / Customer Relations / Analytics / Developer Tools / Extensibility)
2. **What resource does the aggregate map to?** (One Apple resource → one aggregate. If it's two resources, you need two slices talking through domain-level navigation.)
3. **Which fields belong to the aggregate vs its children?** (Privacy URLs live on `AppInfoLocalization`, not `AppInfo` — because that's how Apple's resource owns them. Match the ownership, not the UI layout.)
4. **What affordances does the backend expose?** (List them by name. Every mutator you ship should correspond to one affordance. If the backend doesn't expose one, fall back to the mock repository for that specific method and `warnOnce` — never silently no-op while clearing dirty state.)
5. **What capability booleans does the UI need?** (Every disabled-button / greyed-out branch should map to a `canX` getter on the domain, not an `'action' in affordances` check in JSX.)

If any answer is hand-wavy, **stop** and resolve it before coding.

## Anti-patterns that signal architectural drift

Catch these in review; they mean the slice pattern is being bent out of shape:

- **DTO interfaces at the REST boundary** (`interface FooDTO { ... }`) — delete them. `Record<string, unknown>` + `Foo.fromJSON` is the path. The domain owns hydration.
- **`supportUrl` / `marketingUrl` on AppInfo** — they belong to `AppStoreVersionLocalization`. When a field has nowhere to save to, it shouldn't exist on the aggregate.
- **Top-level aggregate fields that duplicate a child's state** — make the top-level a delegating getter onto the child instead (see `AppInfo.privacyPolicyUrl` delegating to the primary localization).
- **Conditional body assembly in save** (`if (x !== null) body.x = x`) — breaks the "clear by sending null" contract. Always include the field; let `null` mean "clear".
- **Fetching from a component** — move it into the slice's `hooks.ts`.
- **Cross-slice imports from `infrastructure/` or `pages/`** — only import another slice's **domain class**. If you need more, lift behavior onto that domain class.
- **`save()` that `markSaved()`s the aggregate even when half the fields weren't actually persisted** — the dirty flag must reflect reality or the UI lies to the user.
- **Free `fetchX(appId, mode)` functions** — legacy; migrate to a repository port the next time you touch the slice.

## Adding the slice — concrete sequence

1. **Decide the context folder**: `src/app-catalog/`, `src/release/`, `src/monetization/`, `src/customer-relations/`, `src/analytics/`, `src/developer-tools/`, or `src/extensibility/`.
2. **Scaffold the six files** above at `src/<context>/<feature>/`.
3. **Write failing tests** in `tests/<context>/<feature>/<Feature>.test.ts` for one member at a time. Make each pass with the minimum change, then move to the next.
4. **Register the page route** in `src/App.tsx` (lazy import + `<Route>`).
5. **Verify:** `npm test` and `npx tsc -b` both clean.
6. **Smoke-test in the browser** for UI changes — `npm run dev`, exercise the golden path and at least one edge case. If you can't, say so explicitly rather than claiming success.

## Ship checklist

- [ ] `<Feature>.ts` — `makeAutoObservable`, options-object init, semantic booleans, capability getters, display getters, navigation mutators (gated on affordance, `runInAction` for post-await state), `static fromJSON(json, repo?)`.
- [ ] `<Feature>Repository.ts` port — methods named in domain terms; save split to match real HTTP endpoints.
- [ ] `<Features>.ts` root aggregate — thin.
- [ ] `infrastructure/<Feature>.api.ts` — `Rest<Feature>Repository` follows affordance URLs; `repositoryFor(mode)` factory; falls back to mock per-method with `warnOnce` when an affordance is absent.
- [ ] `infrastructure/<Feature>.mock.ts` — `Mock<Feature>Repository` seeds fixtures; attaches `this` to every domain object; affordance values are HATEOAS hrefs.
- [ ] `<Feature>.hooks.ts` — uses `useDataMode()`, builds aggregate via `repositoryFor(mode)`, cancellation flag.
- [ ] `pages/<Feature>Page.tsx` — `observer()`-wrapped where it reads observables; no `apiClient` / `infrastructure/` imports.
- [ ] `tests/<context>/<feature>/<Feature>.test.ts` — grouped by member kind; plain `vi.fn()` stubs; asserts on mutated state; domain class never mocked.
- [ ] `npm test` green; `npx tsc -b` clean.
- [ ] Route registered in `src/App.tsx`.
- [ ] No new DTO interfaces, no free `fetchX` functions, no cross-slice `infrastructure/` imports.

## When the user asks to migrate a legacy slice

Several slices still export `fetch<Feature>(appId, mode)` and construct plain value objects (see `release/build/`, `release/version/`, `release/testflight/`, `monetization/iap/`, `developer-tools/code-signing/`). Migrate them opportunistically when you touch one:

1. Introduce the `<Feature>Repository` port.
2. Rebuild `<Feature>.ts` as a MobX observable with the five member kinds.
3. Replace `fetchX` with `Rest<Feature>Repository` + `Mock<Feature>Repository` + `repositoryFor(mode)`.
4. Add `<Features>.ts` root aggregate.
5. Rewrite the hook to use the aggregate.
6. Rewrite tests against the rich domain (state-based).
7. Update UI bindings from raw-field reads to capability/display getters.

The full walkthrough lives at `docs/features/README.md` under "Migrating a legacy slice".

## Final reminder

The point of the pattern is that **every slice looks the same** — once you've read one, you've read them all. That's what makes six months of accumulated complexity navigable. Every exception compounds. If a feature genuinely can't fit, the right move is to pause and rethink the architecture with the user, not to write a one-off exception that future maintainers will copy.