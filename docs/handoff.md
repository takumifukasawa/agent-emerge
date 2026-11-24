# handoff — 現在地

<!-- 最終更新は絶対日付で。session-handoff が更新し、session-catchup が最初に読む。
     長期タスクの機械可読な進行状態は .harness/state/ に置き、ここには人間向けの要約だけ書く。 -->

最終更新: 2026-11-24

## いま何をしているか（1〜3 行）

Building the MVP read-only viewer (Electron) for Claude Code skills / harness, per account. Plan: `docs/plans/active/mvp-readonly-viewer.md`.
Done through task 6 (skills × accounts matrix with diffs, layout B). Remaining work is GitHub issues #1–#14.

## 状態

| 項目 | 状態 | 出典 |
|---|---|---|
| Spec / decisions 0001–0005 | 合意済 | `docs/spec/mvp-readonly-viewer.md`, `docs/decisions/` |
| Scaffold, structural tests, leak check, fixtures | 検証済み | `harness check` |
| fsread / gitread / account discovery / prefs.json | 検証済み | `harness check` (unit + e2e) |
| claude-code adapter (skills, plugins, provenance) | 検証済み | `src/main/adapters/claude-code`, `harness check` |
| Skills matrix + diff UI (layout B) | 検証済み | `test/e2e/launch.spec.ts`, `harness check` |
| Remaining MVP tasks 7–12 | 未着手 | GitHub issues `gh issue list --label mvp` |
| Pushed to GitHub | **未 push**（origin は空の公開リポジトリ） | `git log --branches --not --remotes` |

## NEXT（依存順。順序制約があれば明記）

1. **Push first** (with the push-gate review: `bash .harness/scripts/push-gate.sh --stamp` after reviewing unpushed commits). The issues reference files that are not on GitHub yet.
2. #8 (decide the long-description threshold) → then #1 warnings. #1 uses the fixture cases in `test/fixtures/README.md`.
3. #4 sources + harness projects (drift) — independent of #1; feeds sidebar badges.
4. #2 CLAUDE.md + memory, #3 settings / MCP / masking — independent of each other.
5. #5 catalogs (needs a new catalog fixture), #6 file watching, #7 dmg.
6. After the MVP: #11 Phase 1.5 dashboard (needs a short spec first).

## 未確定事項（人間の判断待ち）

- #8 threshold for "description too long" (proposal 1024 chars)
- #9 final app name
- #10 LICENSE copyright holder line

## このセッションで触らなかったが確認したもの

- `docs/roles/`, `docs/rules/` — harness defaults, no project-specific changes needed yet.
- `docs/architecture.md` — up to date with the code (unenforced rows are listed there and in tech-debt).
- `.harness/manifest.json` managed files — untouched (see `harness status`).
