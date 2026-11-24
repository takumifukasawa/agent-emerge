# 0004: Roadmap additions after reading the article's figures

- 日付: 2026-11-24
- 状態: 採用（Q32–Q35, user approved）
- 補足: extends 0003. Feature inventory: docs/references/dena-harness-app-screens.md

## 背景
The figures showed features missing from the 0003 roadmap: an overview dashboard, AI-generated CLAUDE.md suggestions and
skill generation from memory, and a concrete routine execution model.

## 採用案
- **Q32 Phase 1.5 (right after the MVP): overview dashboard.** Read-only, offline aggregation of session logs and memory:
  period / project filters, sessions, projects, utterances, tokens, sessions per model, daily activity, per-project share, memory by type. Per account.
- **Q33 AI generation joins Phase 2** (with install / update): CLAUDE.md suggestions and skill generation from memory.
  Helper skills run headless via the Agent SDK with JSON input / output files; results are previews; applying goes through the same
  backup / preview / approval path as installs.
- **Q34 Phase 3 routines run only while the app is running; missed runs are caught up on next launch.** No launchd / OS scheduler entries.
- **Q35 Layout**: roots (accounts, sources, catalogs, harness projects) in the sidebar, features as tabs — because "per account" is the
  app's axis. The design mock (plan task 5.5) shows this next to the article-style "features in the sidebar" layout for a final pick.

## 落選案と落選理由
- Dashboard in the MVP itself: keeps the MVP small; the index layer is designed so it can be added without rework.
- AI generation as its own later phase: it needs exactly the write-safety machinery Phase 2 builds, so they ship together.
- launchd-based routines: writes outside the app's own data and runs without the app visible; harder to make safe and explain.

## 影響・やり直す条件
- Revisit Q34 if users need routines while the app is closed.
