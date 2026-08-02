# 🧠 Reaper — Security Orchestration Dashboard

[![Version](https://img.shields.io/badge/version-1.0.0-blue)](https://github.com/berman0x/reaper-core)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.x-61DAFB?logo=react)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-8.x-646CFF?logo=vite)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.x-38B2AC?logo=tailwind-css)](https://tailwindcss.com/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen)](https://github.com/berman0x/reaper-core/pulls)

---

## What this is

Reaper is a TypeScript + React security orchestration dashboard built for incident response training, threat simulation, and playbook automation. It provides a responsive web UI for running local, non-destructive simulations, monitoring simulated assets, and exporting incident data for analysis.

> ⚠️ Disclaimer — This repository is intended for defensive security training and simulation. It is not a command-and-control (C2) tool. Use responsibly.

---

## Key features

- Real-time dashboard with charts and activity feed
- Asset management with status and risk scoring
- Playbook simulation (ransomware, exfiltration, privilege escalation)
- Exportable incident logs (JSON)
- Theme support (dark / light) and responsive UI

---

## Stack

- Language(s): TypeScript (primary), PLpgSQL (supabase migrations), CSS
- Framework / runtime: React 19 + Vite 8 (React + Vite single-page app)
- Notable libraries:
  - @tanstack/react-router / react-query / react-start (routing + data)
  - Tailwind CSS (styling)
  - Recharts (charts)
  - Zustand (state)
  - @supabase/supabase-js (optional backend integration)

---

## How it's organized

Top-level layout (important entries only):

```
.
├── .env.example             # Example env (VITE_WS_URL)
├── AGENTS.md                # Lovable/project connection / notes
├── package.json             # Project metadata & scripts
├── tsconfig.json
├── vite.config.ts
├── public/                  # Static assets (favicon, icons, etc.)
├── src/                     # Application source (frontend + entry points)
│   ├── components/          # Shared UI components & modules
│   │   └── ui/              # Design-system primitives (buttons, dialogs, table, sidebar)
│   ├── config/              # App configuration
│   ├── hooks/               # Custom React hooks
│   ├── integrations/        # Integration adapters (supabase, ws, etc.)
│   ├── lib/                 # Utility libraries and helpers
│   ├── routes/              # File-based routes used by TanStack Start
│   ├── stores/              # Zustand stores
│   ├── router.tsx           # Router bootstrap
│   ├── server.ts            # Local dev/ws server integration (monitor endpoint)
│   ├── start.ts             # App start/bootstrapping
│   └── styles.css           # Global/tailwind styles
├── supabase/                # Optional supabase config & migrations
│   └── config.toml
└── README.md
```

How it fits together:
- The UI is a Vite-powered React app; routes are file-based (TanStack Start conventions) under `src/routes/`. `src/start.ts` / `src/server.ts` contain bootstrapping for the dev server and optional websocket monitor. UI components live under `src/components/` with an internal `ui/` design-system used across pages. Optional backend/state sync uses Supabase (supabase config present).

---

## Quickstart (development)

Prerequisites:
- Node.js 18+ (nvm recommended)
- npm / pnpm / yarn

Install and run locally:

```bash
# clone (if you haven't already)
git clone https://github.com/berman0x/reaper-core.git
cd reaper-core

# install dependencies
npm install

# start development server (Vite)
npm run dev
```

Open: http://localhost:5173 (Vite default). The client will read VITE_WS_URL from environment at build time — see `.env.example` for defaults.

Available npm scripts (in package.json):
- npm run dev        — start Vite dev server
- npm run build      — build for production
- npm run build:dev  — build in development mode
- npm run preview    — preview the production build
- npm run lint       — run eslint
- npm run format     — run prettier

Environment variables:
- VITE_WS_URL — WebSocket monitor endpoint (defaults to ws://localhost:3000 if not set). See .env.example.

---

## Production build & deployment

Build:

```bash
npm run build
```

Preview:

```bash
npm run preview
# or deploy `dist/` to your static host
```

Deployment notes:
- The output folder created by Vite is suitable for static hosts (Vercel, Netlify, etc.).
- If you use server-side components or Supabase features, ensure environment variables and API keys are configured in the host.

---

## Notable files & locations

- package.json — project scripts and dependencies
- .env.example — example env values (VITE_WS_URL)
- src/start.ts — app bootstrap
- src/server.ts — local server / websocket monitor integration
- src/router.tsx / src/routeTree.gen.ts — routing entry points
- src/components/ui/ — design-system primitives (accordion, dialog, table, sidebar, etc.)
- supabase/config.toml — supabase config and migrations (if used)
- AGENTS.md — Lovable integration and repository notes

---

## Contributing

Contributions are welcome. Suggested workflow:

1. Fork the repo or branch off a feature branch on the main repo.
2. Create a small, focused pull request with tests where applicable.
3. Keep history intact (do not force-push or rewrite published history) — this repository is connected to an external editor/integration; avoid rebasing/amending/squashing commits that are already pushed.
4. Run lint and format before opening a PR:

```bash
npm run lint
npm run format
```

Please provide clear descriptions for any new playbooks or simulation scenarios you add, and include non-destructive example data where possible.

---

## Testing & development guidance

- UI components are plain React + TypeScript and can be exercised via the dev server.
- If integrating with Supabase locally, create a local Supabase project and apply migrations found in `supabase/migrations` (if any).
- For WebSocket monitor functionality, ensure VITE_WS_URL points to the monitoring socket (see .env.example).

---

## Security & Responsible Use

This project is intended for defensive training and lab simulations. Do not use the code for offensive operations. The authors are not responsible for misuse. If you add modules that interact with real systems, clearly document permissions, boundaries, and safeguards.

---

## License

MIT — see the LICENSE file.

---

## Acknowledgments & Contact

- Built with ❤️ by the Black Lotus Syndicate
- Inspired by modern SOAR platforms and incident response frameworks

Project maintainer: https://github.com/berman0x
