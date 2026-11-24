# On-disk formats this app reads (observed)

Source: observed on a real machine (Claude Code, 2026-11) and agent-harness 1.3.1 (`.harness/bin/harness`). Retrieved 2026-11-24.
Only structure is recorded here, never values. Re-check when Claude Code or agent-harness changes.

## Claude Code account (config dir)

- Account dir: `~/.claude` (default) or any dir set via `CLAUDE_CONFIG_DIR` (e.g. `~/.claude-<name>`).
- **`.claude.json` location differs**: default account → `~/.claude.json` (home dir); `CLAUDE_CONFIG_DIR` account → `<dir>/.claude.json`.
  - `projects`: object keyed by absolute project path; entries have `allowedTools`, `mcpServers`, `enabledMcpjsonServers`, … plus many usage stats.
  - `mcpServers`: user-scope MCP servers, `{ type, command, args, env }` (stdio) — `env` may hold secrets.
  - Many other keys are caches / UI state; ignore them.
- `settings.json`: `env`, `permissions`, `hooks`, `enabledPlugins` (`{ "<plugin>@<marketplace>": bool }`), `model`, `extraKnownMarketplaces`, ….
- `skills/<name>/SKILL.md` (often symlinks), `agents/*.md`, `commands/*.md`, `CLAUDE.md` (`@path` imports).
  `@path` imports (as the app reads them): a token at line start or after whitespace, outside code spans / fences; relative to the importing file, `~/` = home, absolute allowed; recursive, at most 5 hops. Project files: `CLAUDE.md`, `CLAUDE.local.md`, `.claude/CLAUDE.md`, `AGENTS.md`.
- `plugins/installed_plugins.json`: `{ version, plugins: { "<plugin>@<marketplace>": [ { scope, installPath, version, installedAt, lastUpdated, gitCommitSha? } ] } }`.
  Plugin content under `plugins/cache/<marketplace>/<plugin>/<version>/` (also contains `.in_use/` markers; ignore them).
  `known_marketplaces.json`: marketplace name → `{ source, installLocation, lastUpdated }`.
  Marketplace manifest: `<installLocation>/.claude-plugin/marketplace.json` → `{ name, owner, metadata, plugins: [ { name, source, description, skills?: ["./dir", …] } ] }`.
  **Where a plugin's skills live varies**: `skills/<name>/SKILL.md` (default), paths in `plugin.json` `skills`, or paths declared by the
  marketplace entry's `skills` (observed: no `plugin.json` at all, skill dirs at the plugin root). The adapter checks all three.
- `projects/<encoded path>/`: session logs `<uuid>.jsonl` and `memory/` (`MEMORY.md` index + one file per memory).
  Memory files: frontmatter `name`, `description`, `metadata.type` (some write a top-level `type`): `user` / `feedback` / `project` / `reference`.
  Encoded path = absolute project path with every non-alphanumeric char replaced by `-`.

## skills CLI (`~/.agents`)

- `~/.agents/skills/<name>/` + `~/.agents/.skill-lock.json`: `{ version, skills: { <name>: { source, sourceType, sourceUrl, skillPath, skillFolderHash, installedAt, updatedAt, ref?, pluginName? } } }`.

## agent-harness `.harness/manifest.json`

- Top: `harness_version, source, source_ref, source_commit, installed_at, agents, files[]`.
- `files[]`: `{ path, src, ownership: managed|seed|merge|generated, sha256, source_sha256 }`.
- **`sha256` is not SHA-256**: it is `git hash-object --no-filters <file>` (git blob SHA-1, 40 hex). `-` or empty = no value.
- `merge` files (e.g. `AGENTS.md`): hash covers only the managed block(s) — lines from one starting with `<!-- harness:begin` through `<!-- harness:end -->`, concatenated, hashed with `git hash-object --stdin`.
- Drift = a `managed` / `merge` / `generated` file whose current hash differs from `sha256`, or is missing. `seed` files belong to the project; edits are expected.
