# frontend/ — Web Client (React + Vite + TypeScript)

**Purpose:** The officer/leadership-facing web application (SAD Section
3.1/4). Single-page app with a persistent shell, role-rendered sidebar,
and route-level code splitting for heavy modules (map, graph, reports).

**Responsibility:** Render role-appropriate dashboards, never hold a
second copy of source-of-truth data (server state lives in React Query),
and always respect the current jurisdiction Context Bar scope.

## Structure
- `src/app/` — routing, shell, providers (Query, Auth)
- `src/modules/` — one folder per SAD sidebar module (dashboard, hotspot, network, ...)
- `src/components/` — shared design-system + map/graph/chart primitives
- `src/hooks/` — data-fetching hooks (React Query wrappers)
- `src/services/` — typed Axios API clients, one per backend module
- `src/state/` — Zustand UI-only stores
- `src/types/` — shared TypeScript types (mirrors backend schemas)

## Run locally
```bash
npm install
npm run dev
```

Full file-by-file mapping: see `PROJECT_STRUCTURE.md` at the repo root.
