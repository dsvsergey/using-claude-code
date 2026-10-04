#!/usr/bin/env bash
# macOS/Linux entry point: make sure Node >= 18 exists, then hand off to lib/apply.mjs.
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

node_ok() {
  command -v node >/dev/null 2>&1 && [ "$(node -p 'process.versions.node.split(".")[0]')" -ge 18 ]
}

if ! node_ok; then
  echo "Node.js >= 18 is required."
  if [ "$(uname)" = "Darwin" ] && command -v brew >/dev/null 2>&1; then
    answer=n
    if [[ " $* " == *" --yes "* || " $* " == *" -y "* ]]; then
      answer=y
    elif [ -t 0 ]; then
      read -r -p "Install with 'brew install node'? [y/N] " answer
    fi
    case "$answer" in
      y|Y|yes) brew install node ;;
      *) exit 1 ;;
    esac
  else
    echo "Install Node.js LTS (https://nodejs.org/en/download, your package manager or nvm) and re-run."
    exit 1
  fi
fi

exec node "$DIR/lib/apply.mjs" "$@"
