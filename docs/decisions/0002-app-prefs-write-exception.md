# 0002: The app may write only its own preferences file

- 日付: 2026-11-24
- 状態: 採用（user approved, 2026-11-24）

## 背景
The spec requires editable display names and manually added roots (accounts / sources / catalogs / harness projects).
They must survive restarts, so something has to be written. The invariant "no write API over IPC" (architecture) forbids that as worded.

## 採用案
- Only `src/main/prefs/` may write, and only one file: `<Electron userData>/prefs.json` (atomic: temp file + rename).
  It never writes under `~/.claude*`, sources, catalogs or projects.
- IPC channels with a write verb are allowed only in the `prefs:` namespace.
- `src/main/fsread/` stays strictly read-only. Structural tests enforce both.

## 落選案と落選理由
- Keep prefs in renderer `localStorage`: hides state from main (discovery runs in main) and is harder to test.
- No persistence: contradicts the agreed spec (Q1: display names are editable).
- Store prefs inside the account dir (e.g. `~/.claude/agent-emerge.json`): writes into the user's Claude config, which this app promises never to touch.

## 影響・やり直す条件
- Phase 2 write features (install / update from catalogs) need their own decision with backups, previews and human approval; they must not reuse this exception.
