# 0001: Product scope — a public desktop app for managing Claude Code skills and harness, per account

- 日付: 2026-11-24
- 状態: 採用

## 背景
Inspired by DeNA's "geniハーネスくん" (https://engineering.dena.com/blog/2026/07/claude-code-harness-app/, Electron + React, Agent SDK runs small skills headless and they exchange JSON files).
We want a local app that manages skills and the harness. Three questions were settled with the user.

## 採用案
1. **MVP = read-only viewer.** List and inspect user- and project-level skills / CLAUDE.md / hooks / settings / MCP. AI suggestions, routines and sharing come later.
2. **"Harness" means both**: Claude Code configuration in general, and agent-harness-managed projects (status / drift / diff across projects).
   **Separated per account** (config dir such as `~/.claude`, `~/.claude-personal`), because each account sees different things.
3. **Audience = public app** (not just the author's own tool). Therefore no hard-coded personal paths, the config dirs must be discoverable or configurable, and nothing user-specific ships.
- Stack: Vite + TypeScript + Electron, state with zustand (or a small hand-rolled store).

## 落選案と落選理由
- Start with AI-driven suggestions (as in the article): needs safe write paths (backup, temp-file write, preview) first; the read-only viewer is the base for that.
- Single merged view across accounts: the accounts see different things, so merging would mislead.
- Personal-only tool: rejected by the user; the app is meant to be published.

## 影響・やり直す条件
- Every feature takes "account (config dir)" as its top-level scope.
- Revisit if we decide to support sharing / team catalogs (article's "共有ハーネス"), which needs leak scanning before anything leaves the machine.
