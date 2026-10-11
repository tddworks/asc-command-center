# Contributing

Thanks for helping. This page covers running the app, testing, and getting a PR merged. Agents working in the repo also read [CLAUDE.md](CLAUDE.md).

## Run & test

Needs Node 22.12 or later (`.nvmrc` pins 24, which CI uses).

```bash
git clone https://github.com/tddworks/asc-command-center.git && cd asc-command-center
npm install
npm run dev              # http://localhost:5173
npm test                 # all tests
npx vitest run tests/release/build/Build.test.ts -t "is usable"   # one file, one test
npx tsc -b               # type-check, as CI does
```

You don't need an App Store Connect account to work on the UI. With no backend running, the app starts in **mock mode** and every slice serves deterministic fixtures from its `infrastructure/*.mock.ts`. To work against real data, install the [`asc` CLI](https://github.com/tddworks/asc-cli) (`brew install tddworks/tap/asccli`) and run `asc web-server`; the UI detects it on `/api/v1` and switches to **rest** mode. The header toggles between the two.

## How code is organised

Features are vertical slices grouped by bounded context (`app-catalog`, `release`, `monetization`, `customer-relations`, `analytics`, `developer-tools`, `extensibility`). Each slice owns its domain class, repository port, hooks, REST and mock infrastructure, and UI. The rules are in [CLAUDE.md](CLAUDE.md#feature-module-layout--bounded-context-over-cake-slice); the step-by-step playbook is [docs/features/README.md](docs/features/README.md); the domain model is in [docs/domain/](docs/domain/). Plugins: [docs/plugins/README.md](docs/plugins/README.md).

## Rules

- **Start from the problem.** An issue or PR says what someone was doing and what got in the way before it proposes a fix: a request for a solution hides the real need (the [XY problem](https://xyproblem.info)). The issue and PR templates ask in that order.
- **Test first.** Chicago-school TDD with Vitest: write a failing test in `tests/<context>/<feature>/` that states the behaviour in domain terms, watch it fail, then change `src/`. Assert on resulting state, not on calls; stub repositories with `vi.fn()`, never the domain class. Bugs get a failing test before the fix. Pure CSS, layout and copy changes are exempt.
- **Rules live in the domain.** Components read `build.isUsable` and `build.canAddToTestFlight`; they don't compare enums or inspect `_links`.
- **Mock and rest stay equivalent.** A new backend field or affordance goes into the mock fixtures too, in the same shape.
- **No real data.** Fixtures, tests and screenshots use made-up apps, `com.example.*` bundle IDs and `@example.com` addresses — never real keys, IDs, names or reviews.
- By opening a pull request you agree that your contribution is licensed under the [Apache License 2.0](LICENSE), like the rest of the project.

## Before you push

```bash
npx tsc -b && npm test && npm run build
```

CI runs the type-check and tests with coverage on every PR. Merges to `main` deploy to [cc.asccli.app](https://cc.asccli.app).
