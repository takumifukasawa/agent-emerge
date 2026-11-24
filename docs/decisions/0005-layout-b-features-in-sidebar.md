# 0005: Layout B — features in the sidebar, account picked at the top

- 日付: 2026-11-24
- 状態: 採用（user picked B from the mock）
- 補足: settles the layout question 0004 (Q35) left to the mock. Mock: a private claude.ai artifact kept by the owner (not linked)

## 背景
Two layouts were mocked with the same fixture data and the same skills × accounts screen:
A = roots (accounts / sources / catalogs / harness projects) in the sidebar, features as tabs; B = article style, features in the sidebar.

## 採用案
B. Sidebar, top to bottom: account picker (`All accounts` + each account), features (Overview [phase 1.5], Skills, CLAUDE.md, Settings,
MCP, Plugins, Agents & commands, Memory), "where they come from" (Sources, Catalogs, Harness projects) with status badges, Settings + version.
The Skills page shows the skills × accounts matrix when `All accounts` is picked; a detail pane on the right shows provenance and diffs.

## 落選案と落選理由
- A: each sidebar pick changed what the main area meant (an account → its tabs, "All accounts" → the matrix); B keeps one meaning per page
  and gives the Phase 1.5 overview a natural home.

## 影響・やり直す条件
- Per-account pages read the picked account; with `All accounts` they show one section per account or ask to pick one.
