#!/usr/bin/env bash
set -euo pipefail
lab_root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
python3 "$lab_root/tools/verify-nature.py" > /dev/null
python3 "$lab_root/tools/verify-life-space.py" > /dev/null
cd "$lab_root/app"
if [[ ! -x hz/hzbuild ]]; then
  "${KAIGEN_CLI:-$HOME/.kaigen/bin/kaigen}" restore
fi
hz/hzbuild ios --framework
python3 "$lab_root/tools/verify-nature.py" --materials > /dev/null
