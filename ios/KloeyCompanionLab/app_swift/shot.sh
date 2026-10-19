#!/usr/bin/env bash
# Physical iOS UI driver and named screenshot export; uses saved Xcode signing.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LAB_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CONFIG="${CONFIG:-Debug}"
CMDS="${1:-${CMDS:-wait 2; shot default}}"
RESULT="${RESULT_BUNDLE:-$SCRIPT_DIR/build/test.xcresult}"
SHOTS="${SHOTS_DIR:-$SCRIPT_DIR/build/shots}"
case "$CONFIG" in Debug|Release) ;; *) echo 'CONFIG must be Debug or Release.' >&2; exit 2 ;; esac
python3 - "$SCRIPT_DIR/build" "$RESULT" "$SHOTS" <<'PY'
from pathlib import Path
import sys
root, result, shots = (Path(p).resolve() for p in sys.argv[1:])
if any(root not in p.parents for p in [result, shots]) or result.suffix != '.xcresult':
    raise SystemExit('Capture outputs must be children of app_swift/build; results must end in .xcresult.')
if result == shots or result in shots.parents or shots in result.parents:
    raise SystemExit('The result bundle and screenshot directory must be separate.')
PY
mkdir -p "$SCRIPT_DIR/build"
if [[ -n "${SIMULATOR_UDID:-}" ]]; then
  DESTINATION="platform=iOS Simulator,id=$SIMULATOR_UDID"
else
  if [[ -z "${DEVICE_UDID:-}" ]]; then
    echo 'Set DEVICE_UDID; ./run.sh --list-devices lists paired iPhones. SIMULATOR_UDID validates placeholder UI only.' >&2
    exit 2
  fi
  if ! python3 "$LAB_ROOT/tools/ios-artifacts.py" check --configuration "$CONFIG"; then
    "$LAB_ROOT/build-engine.sh" --configuration "$CONFIG"
  fi
  DESTINATION="platform=iOS,id=$DEVICE_UDID"
fi
if [[ ! -d "$SCRIPT_DIR/KloeyCompanionLab.xcodeproj" || "$SCRIPT_DIR/project.yml" -nt "$SCRIPT_DIR/KloeyCompanionLab.xcodeproj/project.pbxproj" ]]; then
  python3 "$LAB_ROOT/tools/generate-ios-project.py"
fi
XCODE_ARGS=(-allowProvisioningUpdates -project "$SCRIPT_DIR/KloeyCompanionLab.xcodeproj"
  -scheme KloeyCompanionLab -configuration "$CONFIG" -destination "$DESTINATION"
  -derivedDataPath "$SCRIPT_DIR/build/reconnect-derived" -resultBundlePath "$RESULT")
[[ -z "${SIMULATOR_UDID:-}" ]] || XCODE_ARGS+=(CODE_SIGNING_ALLOWED=NO)
[[ -z "${TEAM_ID:-}" ]] || XCODE_ARGS+=("DEVELOPMENT_TEAM=$TEAM_ID")
rm -rf "$RESULT" "$SHOTS"
set +e
TEST_RUNNER_CMDS="$CMDS" xcodebuild test "${XCODE_ARGS[@]}" 2>&1 | tee "$SCRIPT_DIR/build/uitest.log"
TEST_RC=${PIPESTATUS[0]}
set -e
EXPORT_RC=0
mkdir -p "$SHOTS"
xcrun xcresulttool export attachments --path "$RESULT" --output-path "$SHOTS" || EXPORT_RC=$?
if [[ "$EXPORT_RC" == 0 ]]; then
  python3 "$LAB_ROOT/tools/export-ios-shots.py" "$SHOTS" "$CMDS" || EXPORT_RC=$?
fi
if [[ "$TEST_RC" != 0 ]]; then
  echo "UI tests failed (exit $TEST_RC); any captures are diagnostic only." >&2
  exit "$TEST_RC"
fi
exit "$EXPORT_RC"
