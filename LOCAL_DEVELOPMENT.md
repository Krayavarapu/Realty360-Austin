# Running Realty360 · Austin Edition Locally

Vite + React UI (`client/`) with an Express API (`server/`). In development, run **both** the UI and API servers.

---

## Prerequisites

| Requirement | Notes |
|-------------|--------|
| **Node.js** | LTS 20.x or 22.x |
| **pnpm** | `corepack enable` (version pinned in `package.json`) |

```bash
node --version
pnpm --version
```

---

## Install

```bash
git clone <repository-url>
cd Realty360-Austin
pnpm install
```

---

## Environment (`.env.local` at repo root)

| Variable | Purpose |
|----------|---------|
| `VITE_MLS_GRID_TOKEN` | MLS Grid bearer token — used by `pnpm seed:mls` to populate `data/mls.sqlite` |
| `DATABASE_URL` | Neon Postgres connection string for TCAD cache (`pnpm seed:tcad`, API runtime) |

`VITE_*` vars are inlined into the client bundle. MLS seeding and TCAD use server-side env via `shared/env/load-env-local.ts`.

---

## Seed data (first-time setup)

```bash
pnpm seed:mls    # closed + active/pending → data/mls.sqlite
pnpm seed:tcad   # Travis County parcels → Neon tcad_parcels
```

---

## Run in development

**Terminal 1 — API (port 3001):**

```bash
pnpm dev:api
```

**Terminal 2 — UI (port 3000, proxies `/api` → 3001):**

```bash
pnpm dev
```

Open **http://localhost:3000/** — comparables search + flip analysis.

---

## Other scripts

| Command | Description |
|---------|-------------|
| `pnpm check` | TypeScript (`tsc --noEmit`) |
| `pnpm smoke:flip` | Flip engine + API smoke tests |
| `pnpm docs:architecture-pdf` | Regenerate `docs/ARCHITECTURE_REPORT.pdf` |
| `pnpm build` / `pnpm start` | Production build + single server on port 3000 |

---

## Project layout

| Path | Role |
|------|------|
| `client/` | React UI (Comparables landing, flip results) |
| `server/` | Express API routes |
| `shared/` | Domain logic — MLS, TCAD, comparables, flip, property-profile |
| `shared/mls/sqlite.ts` | MLS SQLite schema + queries (runtime, not a script) |
| `scripts/` | One-off seed and smoke jobs only |

See **`docs/ROADMAP.md`** and **`README.md`** for architecture and API reference.
