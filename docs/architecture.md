# architecture — 境界と不変条件

<!-- 目的: エージェントが「どこに何を置き、何に依存してよいか」をリポジトリだけから推論できるようにする。
     実装の細部は縛らない。境界・依存の向き・データの検証点といった不変条件だけを書き、
     可能な限り機械的に強制する（リンタ・構造テスト）。強制手段が無い不変条件は「未強制」と明記する。 -->

Spec: [spec/mvp-readonly-viewer.md](spec/mvp-readonly-viewer.md). Scaffold exists (task 1); the layout below is the target the remaining tasks fill in.

## 全体の地図（ドメイン / パッケージの階層）

```
src/
  shared/      types for the normalized model + IPC contract (no Node, no DOM)
  main/
    adapters/  one per account kind (claude-code). Reads raw files of that kind → normalized model
    index/     roots discovery (accounts / sources / harness projects), hashing, warnings, settings merge.
               In-memory for MVP; persistent store for aggregation is added here later
    fsread/    the ONLY module that touches the filesystem: read-only helpers + file watching
    gitread/   the ONLY module that spawns git: allowlisted read-only subcommands
    ipc/       registers read-only handlers + "open in editor" / "reveal in Finder"
  preload/     exposes the IPC contract to the renderer (contextIsolation on, no nodeIntegration)
  renderer/    React UI + zustand stores. Talks to main only through preload
test/fixtures/ fictional homes (root: /fixture-root or ~-relative). Never real data
```

## 依存の向き（許される辺だけを列挙する）

`shared ← main/fsread, main/gitread ← main/adapters ← main/index ← main/ipc ← preload ← renderer`

- `renderer` imports only `shared` (types) and the preload API. Never `node:*`, never `electron` main APIs.
- `adapters` / `index` do not import `node:fs` / `child_process` directly; they go through `fsread` / `gitread`.

## 不変条件と強制手段

| 不変条件 | 強制手段 | 状態 |
|---|---|---|
| No leaks in the repo: no absolute home paths, e-mail addresses or token-like strings in tracked / to-be-tracked files or the staged diff. No allowlist | `scripts/check-no-leaks.sh` (`.harness/checks.sh`, fast → pre-commit) | 強制済 |
| Read-only: only `fsread` imports fs and it calls no fs write API; IPC channel names have no write verb; `ipcMain` handlers live only in `src/main/ipc/` | `test/unit/architecture.test.ts` | 強制済 |
| git is spawned only via `gitread` with an allowlist (`status`, `log`, `rev-parse`, `rev-list`, `for-each-ref`) | `test/unit/architecture.test.ts` (only `gitread` imports `child_process`); the allowlist itself gets a unit test with `gitread` (task 4) | 一部強制 |
| No network / telemetry from the app (child processes `claude` / `git` excepted) | `test/unit/architecture.test.ts` (network modules / calls in `src/`, network / telemetry / auto-update packages in `dependencies`) | 強制済 |
| No absolute paths in logs | none yet | 未強制 |
| Secret-looking values are masked by default in the UI | unit test on the masking function + fixture | 未強制 |
| Renderer runs with `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, and imports neither `electron` nor Node built-ins | `test/unit/architecture.test.ts` + e2e asserts the renderer has no `require` | 強制済 |
| Tests are real: vitest and Playwright each report >0 tests | `scripts/check-tests.sh` via `.harness/checks.sh` | 強制済 |

## 意図的に許している自由

- Choice of markdown renderer, diff viewer, component library, CSS approach.
- zustand store layout.
- Hashing algorithm for skill-folder comparison (must be stable across runs).
