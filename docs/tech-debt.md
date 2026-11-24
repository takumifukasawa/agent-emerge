# tech-debt — 既知の負債

<!-- 負債は高金利のローン。溜めて一括返済するより、小さく継続的に返す。
     `harness gc` はここに載っている項目の放置日数を報告する。返済したら行を消さず「返済済 (コミット)」にする。 -->

| # | 内容 | 影響範囲 | 起票日 | 状態 |
|---|---|---|---|---|
| 1 | `skills:matrix` / `skills:diff` re-read and re-hash every account on each call (no snapshot cache) | slow with many skills; revisit with file watching (#6) | 2026-11-24 | 未着手 |
| 2 | Structural tests are regex-based: computed property access (e.g. `fs['write' + 'File']`) would evade the fsread / prefs write checks | read-only invariant | 2026-11-24 | 未着手 |
| 3 | "No absolute paths in logs" invariant is unenforced (`docs/architecture.md`) | privacy | 2026-11-24 | 未着手 |
| 4 | `gitRootOf` in the claude-code adapter walks up to the filesystem root; a source without its own `.git` can be attributed to an enclosing repo | provenance accuracy | 2026-11-24 | 未着手 |
