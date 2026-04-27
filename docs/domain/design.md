
Ubiquitous language

┌──────────────┬───────────────────────────────────────────────────────────────────────────────────────────────┐
│     Term     │                                            Meaning                                            │
├──────────────┼───────────────────────────────────────────────────────────────────────────────────────────────┤
│ ASCWorkspace │ The user's working session: the apps they can reach, plus what they are currently focused on. │
├──────────────┼───────────────────────────────────────────────────────────────────────────────────────────────┤
│ App          │ An application on App Store Connect. Owns its versions, builds, metadata.                     │
├──────────────┼───────────────────────────────────────────────────────────────────────────────────────────────┤
│ Version      │ A specific release of an App. Has lifecycle state.                                            │
├──────────────┼───────────────────────────────────────────────────────────────────────────────────────────────┤
│ FocusPin     │ Value object: { appId, versionId? } — the persisted selection.                                │
├──────────────┼───────────────────────────────────────────────────────────────────────────────────────────────┤
│ Status       │ Display VO derived from VersionState → { label, tone }.                                       │
└──────────────┴───────────────────────────────────────────────────────────────────────────────────────────────┘

Aggregates & entities

ASCWorkspace (root)
apps:        readonly App[]
currentApp:  App | null                   invariant: ∈ apps

    App (aggregate)
      id, name, bundleId, sku, primaryLocale, …
      versions:       readonly Version[]
      currentVersion: Version | null          invariant: ∈ versions

      Version (entity)
        id, versionString, platform, state
        statusLabel, statusTone               (derived from state)
        isLive / isEditable / isPending / isRejected
        canTransitionTo(target)

All three are immutable. Mutation = return a new instance (withVersions, selectVersion, selectApp).

Ports (framework-agnostic)

AppRepository           # already exists — list, get, builds, versions
WorkspaceStore          # read(): FocusPin | null
# write(pin: FocusPin | null): void

Neither port mentions React, HTTP, or localStorage. Adapters (REST client, LocalStorage store, in-memory store) live in infrastructure/. The domain never imports them.

Domain operations

Version — pure getters; no I/O. statusLabel + statusTone are total functions over VersionState.

App — withVersions(list, currentId?) hydrates immutably; selectVersion(id) returns a new App (throws if id ∉ versions); resolveDefaultVersion(list) picks first editable → first → null. loadVersions() delegates to its repo port.

ASCWorkspace — three verbs:
static hydrate(apps: Apps, store: WorkspaceStore): Promise<ASCWorkspace>
selectApp(id): Promise<ASCWorkspace>          # loads versions, applies pin or default, writes pin
selectVersion(id): ASCWorkspace               # local op; writes pin

Invariants (enforced by the aggregate)

1. currentApp is null or in apps.
2. currentApp.currentVersion is null or in currentApp.versions.
3. A pinned versionId that no longer exists on the app is silently dropped, resolveDefaultVersion picks a replacement.
4. selectX(id) with an unknown id throws — no silent no-op.

What this tells us about layering

Domain (pure):           ASCWorkspace, App, Version, FocusPin, Status, ports
Infrastructure:          REST/Mock AppRepository, LocalStorage/Memory WorkspaceStore
Application:             (in React: a hook; in CLI: a command handler; in tests: direct calls)
Presentation:            Sidebar, CLI stdout, Swift UI, …

The React hook becomes a thin adapter — builds Apps(repo) + WorkspaceStore, calls ASCWorkspace.hydrate, stores the result in useState, re-runs on selectApp / selectVersion. If we rewrote the frontend in SwiftUI tomorrow, only the adapter changes; the aggregate and its tests move unchanged.

Questions before writing code

1. Typed IDs? Introduce AppId/VersionId value objects, or keep raw string? The rest of the repo uses raw strings — I'd stay consistent unless you want a broader sweep.
2. FocusPin shape: persist only {appId, versionId}, or also include platform? Platform can be re-derived from the version; storing it is redundant.
3. Error policy on selectApp(unknownId) / selectVersion(unknownId): throw, or silently clear focus? I lean throw — mirrors requireRepo().
4. Does ASCWorkspace own the WorkspaceStore reference, or is it passed to each mutating method? Owning it is tidier; passing makes the aggregate purer (no side-effect field). I lean own it — writes are part of the "select" operation's meaning.

Confirm those four and I'll start from Version.statusLabel/statusTone and work outward. 