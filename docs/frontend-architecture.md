# Frontend architecture

Snapkit uses **React + TypeScript + Vite** inside the existing Electron desktop and local-agent runtime. Vite builds the same dashboard for desktop, the local web UI and the hosted demo/controller. Production serves compiled assets, not development source.

## Why this stack

React provides reusable components and a large ecosystem for growing the product. TypeScript checks component contracts, API adapters and update state before packaging. Vite supplies module bundling, selective icon imports, minification and fast local builds. Electron still provides native dialogs, device tooling and the verified updater.

The dashboard has no server-rendering requirement, so Next.js would add infrastructure without a current product benefit. Switching the desktop runtime to Tauri or rewriting in Flutter would be a separate native integration project. A framework alone does not guarantee faster startup, lower memory use or faster device commands.

## Current migration boundary

| Area | Implementation |
| --- | --- |
| Device cards and empty states | React, typed view models, keyed cards and memoization |
| Updates page, badges, banner, cache controls and install overlay | React, typed external store and desktop bridge |
| Agent HTTP client | TypeScript adapter; existing authorization and timeout behavior |
| Startup | TypeScript module entrypoint; explicit asynchronous initialization |
| Workspace, setup, account, captures, device tools and release builds | Existing JavaScript controllers converted to explicit ES modules |
| Dashboard shell and remaining forms | Existing HTML/CSS and custom accessible dropdowns |
| Landing page, agent, cloud and native desktop | Existing implementations; no framework rewrite |

This is an incremental migration. The remaining JavaScript controllers are not yet fully typechecked: `allowJs` enables interoperability and `checkJs` remains disabled. New TypeScript/TSX code uses strict checking.

## Source layout and ownership

```text
apps/dashboard/
  index.html                    # shell and hosts for feature roots
  vite.config.ts
  tsconfig.json
  src/
    main.tsx                    # bootstrap and compatibility composition
    features/
      devices/                  # model, DeviceCard and controller adapter
      updates/                  # model, store and UpdatePage
      workspace/                # ES module controller
      account/                  # ES module controller
      device-tools/             # ES module controller
      releases/                 # ES module controllers
    shared/
      api/                      # typed agent request boundary
      ui/                       # icons and React language subscription
      types/                    # browser/desktop bridge declarations
      controls/                 # existing custom menus
      i18n/                     # bilingual messages
    legacy/
      device-controller.js      # orchestration during migration
```

React exclusively owns the children of its roots and portal hosts. Controllers must not replace or translate their DOM directly. The device adapter preserves delegated native actions while React renders typed snapshots; unchanged snapshots skip rendering and keyed memoized cards retain identity. Update snapshots notify subscribers only when data changes. Existing keyboard focus, form values and language changes must remain stable.

New features belong under `features/<name>` with typed models, UI components and a small state/API boundary where needed. Import shared contracts explicitly; do not add cross-file global variables or parallel state stores for the same data. Keep SDK operations in the local agent and privileged OS/update actions in Electron. Never put session tokens, OAuth secrets or signing keys in frontend assets.

Migrate account/setup next, then tools/captures and releases. For each feature, move its state and events behind one React owner, preserve public behavior, remove the retired controller and run the existing interaction tests. Avoid creating unused architecture layers.

## Development and verification

Requires Node.js 22.12 or later.

```sh
npm ci
npm run check                 # JS imports/boundaries and strict TS checks
npm run build:dashboard       # production assets in apps/dashboard/build
npm start                     # build and serve local agent/dashboard
npm run desktop:dev           # demo desktop, rebuild/reload on save
npm run desktop:dev:local     # local devices, separate development profile
npm run dev:dashboard         # Vite browser dev server; agent on port 4310
npm test
npm run test:ui
npm run test:pages
npm run desktop:smoke
npm run desktop:dev:smoke
```

`apps/dashboard/build` is generated and ignored by Git. Desktop packaging includes compiled assets; it does not ship a Vite server or depend on runtime React/Lucide packages. The desktop development watcher rebuilds assets and reloads after a successful build. During startup, a loading screen prevents interaction until the controllers and React roots are ready.

## Performance evidence

See [the migration benchmark](frontend-benchmark.md). Claims should distinguish smaller shipped JavaScript, stable rendering and measured startup time. Device scans, builds and downloads retain their own backend/native costs; adopting React does not accelerate those commands.
