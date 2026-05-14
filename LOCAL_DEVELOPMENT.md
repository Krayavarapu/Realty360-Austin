# Running Realty360 · Austin Edition Locally

This repository is a **Vite + React** front end (`client/`) with a small **Express** static server (`server/`) used in production after `pnpm build`. Day-to-day local work uses the Vite dev server only.

---

## Prerequisites

| Requirement | Notes |
|-------------|--------|
| **Node.js** | Use a current LTS or newer (for example **20.x** or **22.x**). Vite 7 expects a recent Node release. |
| **pnpm** | The repo pins the package manager in `package.json` (`packageManager`: pnpm 10.x). Enable Corepack (ships with Node) so the correct pnpm is used: `corepack enable`. |

Verify:

```bash
node --version
pnpm --version
```

If `pnpm` is missing after `corepack enable`, run `corepack prepare pnpm@10.4.1 --activate` (or the version shown in `package.json` under `packageManager`).

---

## Install

From the repository root:

```bash
git clone <repository-url>
cd Realty360-Austin
pnpm install
```

**Why pnpm?** The project includes a **patched dependency** (`wouter`) configured under `pnpm.patchedDependencies`. Installing with npm or yarn may not apply that patch.

---

## Environment variables (optional)

Vite loads env files from the **repository root** (`envDir` in `vite.config.ts`). Create a `.env` or `.env.local` there (both are gitignored).

| Variable | Purpose |
|----------|---------|
| `VITE_MLS_GRID_TOKEN` | Bearer token for the MLS Grid demo feed (`https://api-demo.mlsgrid.com/v2`). Consumed by `client/src/lib/mls/` to populate neighborhoods and comparables. If unset, the calculator falls back to the seeded constants embedded in `client/src/pages/Home.tsx` and logs a warning. |
| `VITE_MLS_GRID_BASE_URL` | Optional override for the MLS Grid base URL. Defaults to `https://api-demo.mlsgrid.com/v2`. Point this at `https://api.mlsgrid.com/v2` once you have a production subscription. |
| `VITE_ANALYTICS_ENDPOINT` | Base URL for the Umami analytics script referenced in `client/index.html`. |
| `VITE_ANALYTICS_WEBSITE_ID` | Umami site id for the same script. |
| `VITE_FRONTEND_FORGE_API_KEY` | Used by `client/src/components/Map.tsx` if you wire in the map (Google Maps proxy). |
| `VITE_FRONTEND_FORGE_API_URL` | Optional override for the forge API base URL (defaults to `https://forge.butterfly-effect.dev`). |
| `VITE_OAUTH_PORTAL_URL` | Used by `getLoginUrl()` in `client/src/const.ts` for OAuth portal flows. |
| `VITE_APP_ID` | App id for the same OAuth helper. |

If `VITE_MLS_GRID_TOKEN` is unset, the calculator still renders using the seeded constants; you'll see a `[mls] live data fetch failed, using seeded constants` warning in the browser console. Set the token in `.env.local` and restart `pnpm dev` to enable live MLS data.

**MLS Grid v2 note:** The replication API only allows a small set of fields in OData `$filter` (for example `OriginatingSystemName`, `StandardStatus`, `PropertyType`). **Bedrooms, bathrooms, and city are not filterable server-side**; the app fetches closed residential rows and applies those constraints in the browser (`client/src/lib/mls/index.ts`). Use DevTools → Network to confirm a single `GET .../Property` per session cache key when changing filters.

If `VITE_ANALYTICS_*` are unset, Vite prints a warning and the analytics script URL is invalid; the **calculator and UI still run**—you will see console/network noise until you define those variables or adjust `client/index.html` for a fully offline setup.

> **Security note.** `VITE_*` variables are inlined into the client bundle at build time, so anything you put in them is visible to anyone who loads the page. That is fine for the public MLS Grid demo token but unsafe for production credentials — for those, proxy MLS Grid through `server/index.ts` and keep the token in a non-`VITE_` env var on the server.

Production static serving uses **`PORT`** (optional, default **3000**) when you run `pnpm start`:

```bash
PORT=8080 pnpm start
```

---

## Run in development

```bash
pnpm dev
```

This runs **`vite --host`**. By default the app is served at **http://localhost:3000/**. If port 3000 is taken, Vite picks the next free port (`strictPort: false` in `vite.config.ts`).

The dev setup may write debug logs under **`.manus-logs/`** (see `vite.config.ts`).

---

## Production-style build and run

Build the client into `dist/public` and bundle the server into `dist/`:

```bash
pnpm build
```

Run the Express server (serves the built SPA and falls back to `index.html` for client routes):

```bash
pnpm start
```

With no `PORT` set, the server listens on **http://localhost:3000/**.

To preview the **built** client with Vite’s preview server instead of Express:

```bash
pnpm preview
```

---

## Other scripts

| Command | Description |
|---------|-------------|
| `pnpm check` | Typecheck with TypeScript (`tsc --noEmit`). |
| `pnpm format` | Format the repo with Prettier. |

---

## Troubleshooting

1. **`pnpm install` and native binaries (esbuild, Tailwind oxide)**  
   If installs complete but builds fail with missing native modules, your environment may be blocking postinstall scripts. With pnpm 10+, run **`pnpm approve-builds`** and allow the needed packages, then reinstall.

2. **Port already in use**  
   Stop the other process or set `PORT` for `pnpm start`. For `pnpm dev`, either free port 3000 or let Vite auto-increment to the next port.

3. **Analytics warnings in the terminal**  
   Define `VITE_ANALYTICS_ENDPOINT` and `VITE_ANALYTICS_WEBSITE_ID`, or ignore the warnings if you do not need analytics locally.

4. **LAN / device testing**  
   `pnpm dev` uses `--host`, so Vite also prints a **Network** URL (for example `http://192.168.x.x:3000/`) usable from other machines on the same network, subject to your firewall.

5. **MLS Grid demo (`VITE_MLS_GRID_TOKEN`)**  
   To verify the token and endpoint outside the app:  
   `curl -sS -H "Authorization: Bearer $VITE_MLS_GRID_TOKEN" "https://api-demo.mlsgrid.com/v2/Property?\$filter=OriginatingSystemName%20eq%20%27actris%27%20and%20StandardStatus%20eq%20%27Closed%27%20and%20PropertyType%20eq%20%27Residential%27&\$top=1"`  
   Expect HTTP 200 and a JSON `value` array. After changing filters in the UI, you should still see only one `Property` request per cache key in the browser Network tab (filters are client-side).

---

## Project layout (quick reference)

| Path | Role |
|------|------|
| `client/` | React app root for Vite (`client/src/`, `client/index.html`). |
| `server/index.ts` | Express app for production static hosting. |
| `shared/` | Shared code (aliases `@shared` in Vite). |
| `vite.config.ts` | Vite config, aliases, dev server port/host. |

For product and data methodology, see **`README.md`** in the repository root.
