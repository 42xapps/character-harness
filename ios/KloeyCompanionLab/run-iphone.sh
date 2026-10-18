#!/usr/bin/env bash
set -euo pipefail
lab_root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

needs_server_restart=0
for argument in "$@"; do
  [[ "$argument" == "--restart-server" ]] && needs_server_restart=1
done

if [[ "$needs_server_restart" == 1 ]]; then
  node_binary="${NODE_BINARY:-node}"
  command -v "$node_binary" >/dev/null 2>&1 || {
    printf 'Node.js 23.6 or later is required. Install it or set NODE_BINARY, then retry.\n' >&2
    exit 1
  }
  node_path="$(command -v "$node_binary")"
  if ! "$node_path" -e 'const [major, minor] = process.versions.node.split(".").map(Number); process.exit(major > 23 || (major === 23 && minor >= 6) ? 0 : 1)'; then
    printf 'Node.js 23.6 or later is required. Current version: %s\n' "$("$node_path" --version)" >&2
    exit 1
  fi

  harness_root=""
  for candidate in "$lab_root/../.." "$lab_root/../character-harness" "$lab_root/.."; do
    if [[ -f "$candidate/runtime/src/main.ts" && -f "$candidate/package.json" ]]; then
      harness_root="$(cd "$candidate" && pwd)"
      break
    fi
  done
  if [[ -z "$harness_root" ]]; then
    printf 'Could not find the character-harness checkout beside this iOS lab.\n' >&2
    exit 1
  fi

  python3 "$lab_root/tools/prepare-iphone-env.py" "$harness_root"

  if [[ ! -f "$harness_root/node_modules/yaml/package.json" || ! -f "$harness_root/node_modules/ws/package.json" ]]; then
    command -v npm >/dev/null 2>&1 || {
      printf 'npm is missing. Install Node.js 23.6 or later, then run this script again.\n' >&2
      exit 1
    }
    printf '\nInstalling the character harness dependencies…\n'
    if [[ -f "$harness_root/package-lock.json" ]]; then
      (cd "$harness_root" && PATH="$(dirname "$node_path"):$PATH" npm ci --no-audit --no-fund)
    else
      (cd "$harness_root" && PATH="$(dirname "$node_path"):$PATH" npm install --no-audit --no-fund)
    fi
  fi
fi

exec "$lab_root/app_swift/run.sh" "$@"
