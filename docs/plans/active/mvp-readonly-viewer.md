# MVP read-only viewer

- 開始: 2026-11-24
- 状態: 進行中
- 関連: docs/decisions/0001, 0002, 0003, 0004, docs/spec/mvp-readonly-viewer.md, docs/architecture.md

## 目的（何ができれば完了か）

The acceptance criteria in `docs/spec/mvp-readonly-viewer.md` are all met and `harness check` is green.

## 受け入れ条件（検査で確認できる形に）

- [ ] `harness check` passes, including vitest (>0), Playwright launch smoke (>0), structural tests, leak check
- [ ] Every acceptance criterion in the spec has a test or a structural check pointing at it

## タスク分解（依存順）

Remaining tasks are GitHub issues (label `mvp`); roadmap phases are labelled `roadmap` (#11–#14), open decisions `decision-needed` (#8–#10).

| # | タスク | 状態 | 備考 |
|---|---|---|---|
| 1 | Scaffold: electron-vite + React + TS + zustand, vitest, Playwright (Electron); wire into `.harness/checks.sh` | 完了 | contextIsolation on, nodeIntegration off |
| 2 | Structural tests for architecture invariants (fsread/gitread only, no write IPC, no network) | 完了 | turn 「未強制」 rows into 強制済 |
| 3 | Fixtures: fictional home with 2 accounts, a source repo, a harness project, cases for every warning | 完了 | paths under /fixture-root or ~ |
| 4 | `fsread` + `gitread` + account discovery (`~/.claude`, `~/.claude-*`, manual add, display names) + prefs persistence | 完了 | prefs.json per decisions/0002 |
| 5 | claude-code adapter: skills (user / plugin / harness project), provenance, plugins enabled state | 完了 | `src/main/adapters/claude-code`; not yet exposed over IPC (comes with task 6) |
| 5.5 | UI design mock (HTML) reviewed by the user before building screens | 完了 | user picked B (decisions/0005) |
| 6 | Skill × account matrix: hashing, identical/differs, per-file diff | 完了 | layout B shell + Skills page; warnings column comes with task 7 |
| 7 | Warnings: broken link, frontmatter, missing skill dependency, name collision, long description | 未着手 (#1) | |
| 8 | CLAUDE.md / AGENTS.md with `@import` expansion; memory viewer | 未着手 (#2) | |
| 9 | Settings layers + effective value with origin; MCP; agents; commands; secret masking | 未着手 (#3) | |
| 10 | Sources (git state) + harness projects (manifest drift) | 未着手 (#4) | |
| 10.5 | Catalogs: attach a local clone to an account; marketplace / skills-repo layouts; not installed / installed / version differs | 未着手 (#5) | decisions/0003; needs a catalog fixture |
| 11 | File watching for the open account | 未着手 (#6) | |
| 12 | macOS dmg build (unsigned) | 未着手 (#7) | |

## 決定ログ（日付・決めたこと・理由・落選案）

- 2026-11-24: Scope and all MVP behaviour agreed in a grilling session (Q1–Q25); recorded in decisions/0001 and the spec.
- 2026-11-24: Leak check added before any code, so the first commit is already guarded.

## 進捗ログ（セッションごとに 1〜3 行）

- 2026-11-24: Read the DeNA article, agreed scope, wrote spec / architecture / this plan, added `scripts/check-no-leaks.sh`.

- 2026-11-24: Task 1 done. Electron 45 / electron-vite 6 / Vite 8 / TS 7 / React 19 / zustand 5. Preload is built as CJS (`index.cjs`) so the renderer can stay sandboxed. Checks: typecheck (fast), unit >0, e2e launch >0.
- 2026-11-24: Task 2 done. `test/unit/architecture.test.ts` (10 tests); each rule verified by planting a violation. IPC handlers moved to `src/main/ipc/`. Still open: gitread allowlist test (task 4), no-absolute-paths-in-logs.
- 2026-11-24: Task 3 done. `test/fixtures/{home,clean-home}` + `materialize.ts` (temp copy, `__HOME__` fill, git source repo with upstream). Case catalog: `test/fixtures/README.md`. Formats: `docs/references/claude-code-and-harness-files.md`.
- 2026-11-24: Task 4 mostly done: `fsread` (read-only), `gitread` (allowlist + forbidden args, unit-tested), `discoverAccounts` (auto / CLAUDE_CONFIG_DIR / manual, dedupe by real path), `accounts:list` IPC, e2e shows fixture accounts. Leak-check repair text pointed at `/fixture/home`, which the check itself rejects; changed the text to `/fixture-root` (detection unchanged).
- 2026-11-24: User approved decisions/0002 (prefs.json write exception) and 0003 (catalogs + roadmap). Prefs store + `prefs:*` IPC done; structural tests updated and mutation-checked; e2e verifies a rename survives restart and that userData is isolated via `AGENT_EMERGE_USER_DATA`.
- 2026-11-24: Extracted the article figures (docs/references/dena-harness-app-screens.md); decisions/0004 adds Phase 1.5 dashboard, AI generation in Phase 2, routines-while-running, layout.
- 2026-11-24: Task 5 done. Provenance local / symlink (+ enclosing git repo) / skills-cli (+ lock upstream) / plugin (+ marketplace upstream, version) / broken-link. Plugin skills found via skills/, plugin.json, and marketplace.json `skills` (real-world layout). Frontmatter via `yaml`.
- 2026-11-24: Task 5.5 done: mock with layouts A and B; user picked B (decisions/0005).
- 2026-11-24: Task 6 done. `buildSkillMatrix` (same real path → same, else sha256 of the folder), `diffSkillAcross` (jsdiff, binary-aware); IPC takes skill name + account ids, never paths. Renderer: layout B sidebar, Skills matrix, detail with diff, light/dark via prefers-color-scheme. e2e covers same / differs / single, diff lines, plugin filter, account scope.
- 2026-11-24: Before the first push: removed a private claude.ai artifact link from the spec / decisions/0005 and rewrote the two unpushed commits that carried it; `check-no-leaks.sh` now also rejects private workspace links. Decided #8 (1024 chars, in the spec) and #10 (LICENSE added, holder `takumifukasawa`). New rule: no classes in `src/` (tree-shaking), enforced by a structural test; `PrefsStore` → `loadPrefs` / `savePrefs`, `GitArgsError` → `isGitArgsError`.
- 2026-11-24: Task 7 (#1) done. `src/main/index/warnings.ts`: broken link, invalid frontmatter (missing file / no frontmatter / bad YAML / no name / no description), missing dependency (explicit references only: `Skill tool … "x"`, `Skill(x)`, `skill: "x"`, ``use the `x` skill``; `plugin:name` resolves; disabled plugin skills do not count), name collision (enabled copies only), description > 1024. Chips in the matrix cells, list in the detail pane. Unit tests on both fixture homes + rules; e2e for chips and detail.
- 2026-11-24: Task 10 (#4) done. `src/main/index/sources.ts`: sources = `sourceRoot` of symlinked skills + `~/.agents` for skills-CLI skills + manual; git state via gitread (`status --porcelain`, `rev-list --count HEAD --not --remotes`, `rev-parse --abbrev-ref HEAD`), remote URL parsed from `.git/config` (no `git config` / `remote` in the allowlist). `src/main/index/harness.ts`: projects from each account's `.claude.json` with a manifest + manual; drift via git blob SHA-1 computed in-process, merge = managed blocks only, seed skipped, manifest paths outside the project ignored. Sidebar badges (`N unpushed`, `N drifted`), Sources / Harness pages. Roots load after the first paint (they made e2e time out under load when awaited with the matrix).
- 2026-11-24: Task 8 (#2) done. `adapters/claude-code/instructions.ts` (imports expanded in place, tree with ok / missing / cycle / too-deep) for each account's CLAUDE.md and each harness project's CLAUDE.md / CLAUDE.local.md / .claude/CLAUDE.md / AGENTS.md; `memory.ts` groups `projects/*/memory/` by project (named via `.claude.json` projects), type from frontmatter. CLAUDE.md and Memory pages; both load after the first paint.
- 2026-11-24: Task 9 (#3) done. `adapters/claude-code/settings.ts`: layers user / project / local / managed (managed path injectable via `AGENT_EMERGE_MANAGED_SETTINGS`; e2e points it into the fixture), effective leaves with the winning layer and what it overrode, arrays concatenated; MCP by scope; agents / commands. `src/shared/mask.ts` masks values under key / token / secret / password; click to reveal (values), checkbox for raw JSON. IPC channel is `config:layers` ("settings" contains the write verb "set").

## 未確定事項（人間の判断待ち）

- Final app name — #9 (deferred by the user, 2026-11-24).
