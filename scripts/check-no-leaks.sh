#!/usr/bin/env bash
# Fail if tracked / to-be-tracked files (or the staged diff) contain things that must never be published:
# absolute home paths, e-mail addresses, token-like strings, private workspace links. No allowlist on purpose (docs/decisions/0001, spec).
# Patterns are split ('Use''rs') so this file does not match itself.
set -u
cd "$(git rev-parse --show-toplevel)" || exit 2

home_re='(/Use''rs/[A-Za-z0-9._-]+|/ho''me/[A-Za-z0-9._-]+|[A-Za-z]:[\\]Use''rs[\\])'
mail_re='[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}'
token_re='(sk-[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{10,}|gh[pousr]_[A-Za-z0-9]{20,}|xox[abprs]-[A-Za-z0-9-]{10,}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----)'
# private workspace links: claude.ai chats / projects / artifacts, Google Docs, Slack
link_re='(clau''de\.ai/(artifact|chat|project|code)/|docs\.goo''gle\.com/|[a-z0-9-]+\.sla''ck\.com/)'

fail=0
report() { # <label> <regex>
  local hits
  hits="$(git ls-files -z --cached --others --exclude-standard \
    | xargs -0 grep -I -n -E -- "$2" 2>/dev/null)"
  local staged
  # strip the diff's leading '+' first: it is a valid e-mail local-part char, so an added line "@AGENTS.md" would match
  staged="$(git diff --cached -U0 2>/dev/null | grep -E '^\+' | grep -v -E '^\+\+\+ ' | sed 's/^+//' | grep -E -- "$2")"
  if [ -n "$hits$staged" ]; then
    echo "LEAK ($1):"
    [ -n "$hits" ] && printf '%s\n' "$hits" | sed 's/^/  /'
    [ -n "$staged" ] && printf '%s\n' "$staged" | sed 's/^/  staged: /'
    fail=1
  fi
}
report "absolute home path" "$home_re"
report "e-mail address" "$mail_re"
report "token-like string" "$token_re"
report "private workspace link" "$link_re"

if [ "$fail" -ne 0 ]; then
  cat <<'MSG'
How to fix:
  - Paths: write them as ~/... or use the fictional fixture root /fixture-root. Never a real user's path.
  - E-mail / tokens: remove them. If a secret was real, rotate it; if it was ever committed, run the leak-audit skill.
  - Private links (claude.ai artifacts / chats, Google Docs, Slack): describe what it is instead
    (e.g. "a private mock kept by the owner"). If one was ever pushed, run the leak-audit skill.
  - Do not add an allowlist to get past this check (docs/architecture.md, "No leaks in the repo").
MSG
  exit 1
fi
echo "no leaks found"
