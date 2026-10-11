# ASC Command Center

[![Test](https://github.com/tddworks/asc-command-center/actions/workflows/test.yml/badge.svg)](https://github.com/tddworks/asc-command-center/actions/workflows/test.yml)
[![codecov](https://codecov.io/gh/tddworks/asc-command-center/graph/badge.svg?token=SkIEu5Ds69)](https://codecov.io/gh/tddworks/asc-command-center)
[![Deploy](https://github.com/tddworks/asc-command-center/actions/workflows/deploy.yml/badge.svg)](https://github.com/tddworks/asc-command-center/actions/workflows/deploy.yml)

A React 19 + Vite SPA over the [`asc`](https://github.com/tddworks/asc-cli) App Store Connect CLI. Browse apps, manage versions, edit metadata, manage TestFlight, and submit to App Store review — all driven by the local `asc web-server`.

## Quickstart

```bash
# 1. Install asc CLI
brew install tddworks/tap/asccli

# 2. Start the local backend
asc web-server

# 3. Run the UI
npm install
npm run dev
```

The dev server proxies `/api/*` to `http://localhost:8420`. On boot the UI probes `/api/v1`; if asc isn't running you get a guided install/start sheet from the sidebar.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Vite dev server on port 5173 |
| `npm run build` | Type-check + production build to `dist/` |
| `npm run preview` | Serve the built bundle |
| `npm test` | Vitest suite (jsdom env) |
| `npm run test:watch` | Vitest watch mode |
| `npm run test:coverage` | Vitest with v8 coverage → `coverage/` |

## Architecture

Cake-slice features grouped by bounded context (`app-catalog`, `release`, `monetization`, `customer-relations`, `analytics`, `developer-tools`, `extensibility`). Each slice cuts through six layers: domain class (mutable + observable via MobX), repository port, root aggregate, application hook/instance, REST + mock infrastructure, and UI components. Chicago-school state-based TDD over rich domain classes — see [`CLAUDE.md`](CLAUDE.md) and [`docs/features/README.md`](docs/features/README.md).

## Coverage

Coverage is collected by `@vitest/coverage-v8` and uploaded to Codecov on every push and PR. The HTML report lives at `coverage/index.html` after `npm run test:coverage` for local drilling.

## License

Licensed under the [Apache License, Version 2.0](LICENSE). See [`NOTICE`](NOTICE) for attribution.
