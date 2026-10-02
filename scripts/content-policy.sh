#!/usr/bin/env bash
set -uo pipefail
shopt -s lastpipe
mode="${1:?usage: content-policy.sh repo|dist}"
[ -n "${DENYLIST:-}" ] || { echo "::error::CONTENT_DENYLIST secret is missing"; exit 1; }
tmp="${RUNNER_TEMP:-/tmp}"; deny="$tmp/deny.$$"; bin="$tmp/deny-bin.$$"
printf '%s\n' "$DENYLIST" > "$deny"; grep -v '^\\b' "$deny" > "$bin"
trap 'rm -f "$deny" "$bin"' EXIT

hit() { local rc=0; grep -qIiEf "$1" "${@:2}" || rc=$?; [ $rc -le 1 ] || { echo "::error::grep error $rc"; exit 2; }; return $rc; }
file_hits() {
  if grep -qI . "$1" 2>/dev/null || [ ! -s "$1" ]; then hit "$deny" "$1"
  else strings -n 4 "$1" > "$tmp/str.$$"; hit "$bin" "$tmp/str.$$"; local rc=$?; rm -f "$tmp/str.$$"; return $rc; fi
}

fail=0
case "$mode" in
  repo)
    git ls-files | hit "$deny" && { echo "::error::file name"; fail=1; }
    while IFS= read -r -d '' f; do
      [ "$f" = package-lock.json ] && continue
      file_hits "$f" && { echo "::error::content: $f"; fail=1; }
    done < <(git ls-files -z)
    for c in $(git rev-list HEAD); do
      git show -s --format='%an%n%ae%n%cn%n%ce%n%B' "$c" | hit "$deny" && { echo "::error::commit $c"; fail=1; }
    done
    printf '%s' "${PR_TEXT:-}" | hit "$deny" && { echo "::error::pull request text"; fail=1; }
    ;;
  dist)
    while IFS= read -r -d '' f; do
      file_hits "$f" && { echo "::error::output: $f"; fail=1; }
    done < <(find dist -type f -not -path 'dist/tiles/*' -not -path 'dist/vendor/*' -print0)
    ;;
  *) echo "usage: content-policy.sh repo|dist"; exit 2 ;;
esac
exit $fail
