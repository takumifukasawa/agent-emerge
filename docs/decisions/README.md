# decisions — 決定記録

1 決定 = 1 ファイル。`NNNN-kebab-title.md`。書き換えず、覆す時は新しい決定を足して旧決定に「superseded by NNNN」を書く。

| # | タイトル | 状態 | 日付 |
|---|---|---|---|
| [0001](0001-product-scope.md) | Product scope: public per-account skill/harness manager, read-only MVP | 採用 | 2026-11-24 |
| [0002](0002-app-prefs-write-exception.md) | The app may write only its own prefs file (userData/prefs.json) | 採用 | 2026-11-24 |
| [0003](0003-catalogs-and-roadmap.md) | Catalogs (org + public) as a root kind; roadmap phases 2–4 | 採用 | 2026-11-24 |

## テンプレート

```markdown
# NNNN: タイトル

- 日付: YYYY-MM-DD
- 状態: 採用 / 廃止（superseded by NNNN）

## 背景
## 採用案
## 落選案と落選理由
## 影響・やり直す条件
```
