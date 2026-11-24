# DeNA "geniハーネスくん" — features extracted from the article's screenshots

Source: https://engineering.dena.com/blog/2026/07/claude-code-harness-app/ (the 11 SVG figures, text extracted). Retrieved 2026-11-24.
Inspiration only: we build our own app, not a copy. Sample values in the figures (names, e-mails, IDs) are not reproduced.

## Navigation
Left sidebar: 概要 (overview) / ハーネス管理 (harness management) / 共有ハーネス (shared harness) / ルーティン (routines) / 拡張 (extensions) / 設定 (settings), app version at the bottom.

## Overview dashboard
- Period: today / last week / last month, explicit date range; project filter ("all projects"); "last updated" time.
- KPI tiles: total sessions, project count, average sessions, total utterances, input tokens, output tokens.
- Sessions per model; daily activity (tokens / day and sessions); project distribution (tokens per project);
  memory count by type (user / feedback / project / reference).

## CLAUDE.md suggestion
- Pick a session period → AI proposes an edit from that period's usage.
- Line diff grouped by heading, "+N lines / −M lines detected". 反映 (apply) replaces the text in the editor **without saving**; 破棄 (discard).

## Self-knowledge (skill generation from memory)
- Inputs: period (shared by memory and sessions), "include sessions" toggle, optional skill name (auto-named if empty),
  memory picker with search, type filter with counts, select all / none, limit 100.
- Output preview: skill name, trigger description (editable), SKILL.md preview, knowledge files (`references/*.md`),
  option "add a skill reference to CLAUDE.md". 適用 writes `~/.claude/skills/<name>/`; 破棄.

## Routines
- Daily review on / off, time, weekdays, scope "all projects"; Slack user ID (adds a Slack digest; needs Slack MCP auth),
  Slack channel ID with "auto-post only if the check passes"; save; run now.
- **Runs only while the app is running; runs missed while closed are caught up on next launch.**
- History (last 50): status, posted to Slack, target date + session count; click to open the daily report and extracted TODOs
  (each TODO: title, project, context line).

## Extensions (described as a read-only view)
- Counts: MCP servers, installed plugins, enabled plugins, skills. Tabs: MCP / Plugins / Skills.
- MCP cards: status (running / registered), endpoint, "registered" / "signing key ready", actions (stop, unregister, show auth steps,
  startup settings, show logs). Local vs. official remote servers are distinguished.

## Shared harness
- Tabs: 登録 (register / share) and 改善 (improve from others).
- Share = 3-step stepper: secret scan → review fixes → create PR. Each finding: severity (high / medium), detector (AI or deterministic),
  `file:line`, category (personal name / e-mail / private conversation), and the replacement. Findings are removed automatically before the PR.
- Improve ("みんなのハーネスから改善"): pick members' harnesses; AI suggests items given your harness and usage.
  Card: kind (rule / self-knowledge skill / CLAUDE.md addition), name, priority (high / medium / low), source team handle,
  reason tied to your usage, "view content", "import"; "recommend again".

## Architecture figures
- App = UI (overview / harness management / extensions …) + backend that reads/writes `~/.claude` and runs helper skills headless via the Agent SDK,
  exchanging JSON input / output files.
- `~/.claude` map: `CLAUDE.md`, `settings.json` (permissions, hooks), `skills/`, `rules/`, `projects/<slug>/` with `<session-id>.jsonl`,
  `<session-id>/` (tool results, subagents) and `memory/` (`MEMORY.md` + one file per memory). Memory is per project, not `~/.claude/memory`.
