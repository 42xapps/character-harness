#!/usr/bin/env bash
set -euo pipefail
lab_root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
configuration="${CONFIG:-Debug}"
if [[ "${1:-}" == --configuration && $# == 2 ]]; then
  configuration="$2"
elif [[ $# != 0 ]]; then
  echo "Usage: $0 [--configuration Debug|Release]" >&2
  exit 2
fi
case "$configuration" in Debug|Release) ;; *) echo 'Configuration must be Debug or Release.' >&2; exit 2 ;; esac
python3 "$lab_root/tools/ios-artifacts.py" invalidate
python3 "$lab_root/tools/prepare-nature-materials.py"
python3 "$lab_root/tools/prepare-collision.py" > /dev/null
python3 "$lab_root/tools/verify-nature.py" > /dev/null
python3 "$lab_root/tools/verify-life-space.py" > /dev/null
cd "$lab_root/app"
if [[ ! -x hz/hzbuild ]]; then
  "${KAIGEN_CLI:-$HOME/.kaigen/bin/kaigen}" restore
fi
build_args=(ios --framework)
[[ "$configuration" != Release ]] || build_args+=(--release)
hz/hzbuild "${build_args[@]}"
python3 "$lab_root/tools/verify-nature.py" --materials > /dev/null
python3 "$lab_root/tools/verify-collision.py"
python3 "$lab_root/tools/ios-artifacts.py" record --configuration "$configuration"
