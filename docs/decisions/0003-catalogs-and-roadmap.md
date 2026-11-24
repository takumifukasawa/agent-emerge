# 0003: Catalogs (org and public) as a root kind, and the post-MVP roadmap

- 日付: 2026-11-24
- 状態: 採用（grilling Q26–Q30, user approved）

## 背景
The DeNA article also has "shared harness" (import from an org catalog, with recommendations; share back by PR) and "routines"
(scheduled daily review). The MVP is read-only and offline (0001), but the user wants org catalogs to be first-class too.

## 採用案
- **Catalog format (Q26)**: no proprietary format. A catalog is a git repo in an existing layout:
  a Claude Code plugin marketplace (`.claude-plugin/marketplace.json`) or a skills repo (`skills/<name>/SKILL.md`).
  Rules / CLAUDE.md fragments are out until a real need appears.
- **Auth (Q27)**: the app stores no tokens. Private catalogs use the user's existing git auth (SSH keys, credential helper, `gh`).
- **Per account (Q28)**: catalogs are registered per account (a work account sees the company catalog).
- **MVP (Q29)**: the user clones the catalog; the app registers the local clone and shows, per skill,
  "in catalog, not installed" / "installed" / "version differs". No fetch, no install.
- **Roadmap (Q30)**:
  - Phase 2: fetch catalogs (org + public: marketplaces, skills CLI, agent-harness upstream, any git repo), update checks, install / update.
    Every write needs backup, preview and explicit human approval, under its own decision (not 0002).
  - Phase 3: routines (scheduled review / aggregation of session logs).
  - Phase 4: share to a catalog (leak scan → PR) and AI recommendations.
- Provenance records **upstream URL and ref** wherever known, so Phase 2 update checks reuse it.

## 落選案と落選理由
- Only public distribution sources: the user wants org catalogs.
- A proprietary `catalog.json`: orgs would maintain a second format; Claude Code's `/plugin` could not use it.
- Storing tokens in the app: contradicts "the app holds no secrets".
- Fetch / install in the MVP: needs network and writes; designed together with backups / previews in Phase 2 instead.

## 影響・やり直す条件
- Revisit the format if orgs need to distribute rules or CLAUDE.md fragments.
