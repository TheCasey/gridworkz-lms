# GridWorkz Docs

This directory is organized so work can be delegated cleanly.

Start with these files:

1. [roadmap.md](roadmap.md) for the product-level priority map.
2. [architecture.md](architecture.md) for the current technical shape of the app.
3. A focused doc under `features/`, `specs/`, `upgrades/`, or `audits/` for the task at hand.

Folder guide:

- [features/](features/README.md): Current product areas and behavior notes.
- [specs/](specs/README.md): Scoped build docs for new or incomplete features.
- [upgrades/](upgrades/README.md): Cross-cutting improvements such as tooling, security, performance, or mobile.
- [audits/](audits/README.md): Point-in-time status checks against the product and codebase.
- [archive/](archive/README.md): Legacy planning docs that should not drive current decisions.

Documentation conventions:

- Keep `roadmap.md` high level and status-aware.
- Keep `architecture.md` focused on facts that are true today.
- Put implementation-ready work in a narrow spec or upgrade doc instead of expanding the roadmap.
- When finishing a task, update the focused doc first and the roadmap second.

Recommended handoff flow for agents:

1. Read `docs/roadmap.md`.
2. Read `docs/architecture.md`.
3. Read one focused task doc.
4. Work in code.
5. Update the focused doc and any roadmap status affected by the change.
