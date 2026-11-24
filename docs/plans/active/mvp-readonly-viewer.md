# MVP read-only viewer

- 開始: 2026-11-24
- 状態: 進行中
- 関連: docs/decisions/0001, docs/spec/mvp-readonly-viewer.md, docs/architecture.md

## 目的（何ができれば完了か）

The acceptance criteria in `docs/spec/mvp-readonly-viewer.md` are all met and `harness check` is green.

## 受け入れ条件（検査で確認できる形に）

- [ ] `harness check` passes, including vitest (>0), Playwright launch smoke (>0), structural tests, leak check
- [ ] Every acceptance criterion in the spec has a test or a structural check pointing at it

## タスク分解（依存順）

| # | タスク | 状態 | 備考 |
|---|---|---|---|
| 1 | Scaffold: electron-vite + React + TS + zustand, vitest, Playwright (Electron); wire into `.harness/checks.sh` | 完了 | contextIsolation on, nodeIntegration off |
| 2 | Structural tests for architecture invariants (fsread/gitread only, no write IPC, no network) | 完了 | turn 「未強制」 rows into 強制済 |
| 3 | Fixtures: fictional home with 2 accounts, a source repo, a harness project, cases for every warning | 完了 | paths under /fixture/home or ~ |
| 4 | `fsread` + `gitread` + account discovery (`~/.claude`, `~/.claude-*`, manual add, display names) | 未着手 | |
| 5 | claude-code adapter: skills (user / plugin / harness project), provenance, plugins enabled state | 未着手 | |
| 6 | Skill × account matrix: hashing, identical/differs, per-file diff | 未着手 | main screen |
| 7 | Warnings: broken link, frontmatter, missing skill dependency, name collision, long description | 未着手 | |
| 8 | CLAUDE.md / AGENTS.md with `@import` expansion; memory viewer | 未着手 | |
| 9 | Settings layers + effective value with origin; MCP; agents; commands; secret masking | 未着手 | |
| 10 | Sources (git state) + harness projects (manifest drift) | 未着手 | |
| 11 | File watching for the open account | 未着手 | |
| 12 | macOS dmg build (unsigned) | 未着手 | |

## 決定ログ（日付・決めたこと・理由・落選案）

- 2026-11-24: Scope and all MVP behaviour agreed in a grilling session (Q1–Q25); recorded in decisions/0001 and the spec.
- 2026-11-24: Leak check added before any code, so the first commit is already guarded.

## 進捗ログ（セッションごとに 1〜3 行）

- 2026-11-24: Read the DeNA article, agreed scope, wrote spec / architecture / this plan, added `scripts/check-no-leaks.sh`.

- 2026-11-24: Task 1 done. Electron 45 / electron-vite 6 / Vite 8 / TS 7 / React 19 / zustand 5. Preload is built as CJS (`index.cjs`) so the renderer can stay sandboxed. Checks: typecheck (fast), unit >0, e2e launch >0.
- 2026-11-24: Task 2 done. `test/unit/architecture.test.ts` (10 tests); each rule verified by planting a violation. IPC handlers moved to `src/main/ipc/`. Still open: gitread allowlist test (task 4), no-absolute-paths-in-logs.
- 2026-11-24: Task 3 done. `test/fixtures/{home,clean-home}` + `materialize.ts` (temp copy, `__HOME__` fill, git source repo with upstream). Case catalog: `test/fixtures/README.md`. Formats: `docs/references/claude-code-and-harness-files.md`.

## 未確定事項（人間の判断待ち）

- Final app name.
- Threshold for "description too long".
- LICENSE file: MIT is decided, but the copyright holder line (real name vs. handle) is not.
