# MVP: read-only viewer for Claude Code skills and harness

- Status: agreed (2026-11-24, grilling session Q1–Q25)
- Related: [decisions/0001](../decisions/0001-product-scope.md), [architecture](../architecture.md), [plan](../plans/active/mvp-readonly-viewer.md)

## Purpose

People who run Claude Code with several accounts (config dirs) and maintain their own skills and agent-harness
cannot see, in one place, which skills each account actually has, where each one comes from, whether copies have
drifted, and what is broken. This app shows all of that **without changing anything on disk**.

It is a public, open-source (MIT) desktop app. Working name: `agent-emerge` (to be revisited before release).
Inspiration: DeNA "geniハーネスくん" (https://engineering.dena.com/blog/2026/07/claude-code-harness-app/).

## Stack

Electron + electron-vite + React + TypeScript + zustand. macOS first (unsigned dmg at first);
path handling is written to work on Windows / Linux too.

## Roots (what the app scans)

There are three kinds of roots. Ordinary projects that only have `.claude/skills` are out of scope.

1. **Account**: `{ kind, configDir, displayName }`. `kind` is `claude-code` only for now; other agents (Codex, Cursor…)
   are added later as new kinds via an adapter per kind.
   - Auto-detected: `~/.claude` and `~/.claude-*` directories. Can also be added by hand. Display name is editable.
   - Accounts are always shown separately (each account sees different things). There is no merged view.
2. **Source**: where skills / harness are authored (e.g. a skills git repo, the agent-harness upstream, `~/.agents`).
   - Auto-detected from symlink targets of installed skills and from `~/.agents/.skill-lock.json`. Can be added by hand.
3. **Harness project**: a project with `.harness/manifest.json`.
   - Auto-detected from the account's project history (`projects/`, `.claude.json` projects) filtered to those
     with a manifest. Can be added by hand. Paths that no longer exist are shown greyed out.

## What is read (per account)

| Item | Depth |
|---|---|
| Skills (user / harness-project / plugin) | **Full detail**: frontmatter, rendered body, file tree, provenance |
| CLAUDE.md / AGENTS.md | **Full detail**, with `@import` expanded |
| settings.json (hooks / permissions / env / enabledPlugins) | Each layer (user / project / local / managed) **and** the effective merged value with the layer each value came from. Project layer only for harness projects |
| MCP servers | List + raw view |
| Plugins | Installed / enabled / disabled (from `installed_plugins.json` + `enabledPlugins`) |
| Agents, commands | List + raw view |
| Memory (`MEMORY.md` and memory files) | List + view |
| Session logs | Not in MVP. The index layer must be designed so aggregation (DeNA-style stats) can be added later |

## Main screen: skill × account matrix

- Rows = skill names, columns = accounts.
- Each cell shows presence, provenance (symlink → source / skills-CLI lock / plugin / plain directory) and
  **identical vs. differs** across accounts.
  - Symlinks to the same real path → identical without hashing.
  - Otherwise compare a content hash of the skill folder.
  - A "differs" cell opens a per-file diff.
- Filter to hide plugin-provided skills.

## Warnings (detected read-only)

- Broken symlink.
- Missing / invalid frontmatter (`name`, `description`).
- Missing dependency on another skill (e.g. `grill-me` calls `grilling`, which is not installed).
- Name collision (e.g. plugin skill vs. user skill with the same name).
- `description` too long.
- Harness drift: managed files in `.harness/manifest.json` that differ from what the manifest records (read the manifest directly; the `harness` CLI is not required).
- Source git state: uncommitted changes, unpushed commits (allowlisted read-only git subcommands only).

## Safety

- **No write API over IPC.** The only side-effecting actions are "open in editor" and "reveal in Finder".
- Values whose key contains `key` / `token` / `secret` / `password` (settings `env`, MCP headers / env) are masked
  as `••••` by default; click to reveal.
- No telemetry, no network access (child processes `claude` / `git` excepted), no absolute paths in logs.
- The repository never contains secrets, real local paths or e-mail addresses (enforced by `scripts/check-no-leaks.sh`).

## Acceptance criteria

- [ ] With a fixture home containing two accounts, the app lists both accounts with editable display names.
- [ ] The skill × account matrix shows presence, provenance and identical/differs for the fixture skills; a "differs" cell opens a per-file diff.
- [ ] Each warning above is produced for a fixture case that triggers it, and not produced for a clean fixture.
- [ ] Settings view shows each layer and the effective value with its origin layer.
- [ ] Secret-looking values are masked by default.
- [ ] Editing a fixture file while the app is open updates the view (file watching, only for the open account).
- [ ] The IPC surface has no write operation (checked mechanically, see architecture).
- [ ] `harness check` runs vitest (index layer, against fixtures) and a Playwright (Electron) launch smoke test, both green with >0 tests.
- [ ] `scripts/check-no-leaks.sh` passes.

## Out of scope (MVP)

- Any write to `~/.claude*`, sources or projects (applying suggestions, installing / syncing skills).
- AI-generated suggestions, routines, Slack, sharing to a team catalog.
- Session log aggregation (planned later).
- Agents other than Claude Code.
- Code signing / notarization, auto-update.

## Open questions

- Final app name (before public release).
- Exact "too long" threshold for `description`.
