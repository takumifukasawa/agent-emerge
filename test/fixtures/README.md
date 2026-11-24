# Fixtures

Fictional homes for tests. Never copy real config here; `scripts/check-no-leaks.sh` rejects real paths, e-mails and tokens.
Use them through `materializeFixture()` (`materialize.ts`): it copies a home to a temp dir, fills `__HOME__` /
`__HOME_ENC__`, and turns `dev/skills-repo` into a git repo with an upstream.

Symlinks are relative and committed as symlinks (on Windows, clone with `core.symlinks=true`).
`test/fixtures/**` is `-text` in `.gitattributes`: the harness manifest hashes depend on exact bytes.

## `home/` — every case

| Path (relative to home) | Case | Expected |
|---|---|---|
| `.claude/` | account 1, default kind: its `.claude.json` is `~/.claude.json` | detected as account |
| `.claude-work/` | account 2, `CLAUDE_CONFIG_DIR` style: `.claude.json` inside | detected as account |
| `.claude/skills/shared-skill`, `.claude-work/skills/shared-skill` | both symlink to the same source dir | provenance = source `dev/skills-repo`; **identical** (same real path) |
| `.claude/skills/copied-skill`, `.claude-work/skills/copied-skill` | plain dirs, different body | **differs**; per-file diff on `SKILL.md` |
| `.claude-work/skills/only-here` | only in account 2 | absent in account 1 |
| `.claude/skills/locked-skill` | symlink into `~/.agents/skills`, has lock entry | provenance = skills CLI (`fixture-owner/fixture-skills`) |
| `.claude/skills/broken-link` | symlink to a missing dir | warning: **broken symlink** |
| `.claude/skills/bad-frontmatter` | no `name` / `description` | warning: **invalid frontmatter** |
| `.claude/skills/long-description` | description ≈ 1900 chars | warning: **description too long** (threshold TBD, spec open question) |
| `.claude/skills/needs-missing` | body calls skill `absent-skill` | warning: **missing dependency** |
| `.claude/skills/demo-skill` + plugin `demo` skill `demo-skill` | same name, user vs. plugin | warning: **name collision** |
| plugin `demo@fixture-market` | installed + enabled | plugin skill `demo-skill` listed, enabled |
| plugin `other@fixture-market` | installed, disabled in `enabledPlugins` | plugin skill `other-skill` listed as disabled |
| plugin `rooted@fixture-market` | no `plugin.json`; skill at the plugin root, declared by `marketplace.json` `skills` | plugin skill `rooted-skill` listed, enabled |
| `.claude/plugins/known_marketplaces.json` | github source `fixture-owner/fixture-market` | plugin upstream url = `https://github.com/fixture-owner/fixture-market.git`, ref = installed version / commit |
| `.claude/CLAUDE.md` | `@shared/style.md` import | expanded content includes "Style (imported)" |
| `.claude/settings.json` `env.FIXTURE_API_KEY`, `.claude.json` MCP `env.FIXTURE_TOKEN` | secret-looking keys | **masked** by default; `FIXTURE_PLAIN` / `FIXTURE_REGION` not masked |
| settings layers | user `model=fixture-model`, project `model=fixture-model-project`, local `env.FIXTURE_PLAIN=from-local` | effective `model` from project, `env.FIXTURE_PLAIN` from local |
| `.claude/projects/<enc>-dev-harness-project/memory/` | MEMORY.md + one memory | listed |
| `.claude.json` projects | `harness-project` (has manifest), `plain-project` (no manifest), `missing-project` (does not exist) | only `harness-project` is a harness project |
| `dev/harness-project/.harness/manifest.json` | `clean.sh` matches; `drifted.sh` edited; `checks.sh` is seed (edits are fine); `AGENTS.md` merge block matches; `missing.sh` absent | drift: **`drifted.sh` modified**, **`missing.sh` missing**; nothing else |
| `dev/skills-repo` (git, created at test time) | 1 unpushed commit + 1 uncommitted change | warnings: **unpushed**, **uncommitted** |

## `clean-home/` — nothing to warn about

One account with one valid skill. Every warning check must report nothing here.
