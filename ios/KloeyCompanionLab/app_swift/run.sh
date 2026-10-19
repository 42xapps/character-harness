#!/usr/bin/env bash
# Build, sign, install and launch the native SwiftUI app on a physical iPhone.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LAB_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PROJECT="$SCRIPT_DIR/KloeyCompanionLab.xcodeproj"
SCHEME="KloeyCompanionLab"
BUNDLE_ID="com.kaigen.kloeycompanionlab"
BUILD_ROOT="$SCRIPT_DIR/build/iphone"
DERIVED_DATA="$SCRIPT_DIR/build/reconnect-derived"
CONFIG="${CONFIG:-Debug}"
DEVICE_SELECTOR="${DEVICE_NAME:-${DEVICE_UDID:-}}"
SKIP_ENGINE="${SKIP_ENGINE:-0}"
CONSOLE=0
BUILD_ONLY=0
LIST_DEVICES=0
RESTART_SERVER=0
STAGE="preflight"

usage() {
  cat <<'USAGE'
Build and run Kloey Companion Lab on your iPhone:

  ./run.sh                         Build engine + SwiftUI, install and open
  ./run.sh --skip-engine           SwiftUI-only build; reuse cooked engine
  ./run.sh --device "My iPhone"     Select by exact name, UDID or CoreDevice ID
  ./run.sh --list-devices          List paired physical iPhones; no build
  ./run.sh --build-only            Build and sign; leave the phone app alone
  ./run.sh --console               Stay attached to the app's console
  ./run.sh --restart-server        Reload voice/prompt config before launch
  ./run.sh --configuration Release Build both engine and SwiftUI in Release

Automatic selection prefers the single connected iPhone. If the choice is
ambiguous, select one with --device. Connect/unlock/trust your iPhone and
enable Developer Mode before installing.

Uses the saved Xcode signing settings. If the generated project is absent,
XcodeGen recreates it from project.yml. Sign in to Xcode and choose your team
once on a new Mac if automatic signing needs setup.

The app restores its saved conversation connection. Keep both devices on the
same Wi-Fi for voice. By default the harness server is left running as-is.
Use --restart-server to load changed voice/prompt settings from the enclosing
character-harness checkout, start it on the LAN, and hand the session to the phone.
This resets in-memory conversation history; the new server stays running.
The repository-root launcher prepares .env and Node dependencies on first use.
Node >=23.6 and a stable HARNESS_TOKEN in .env are needed.
Without --restart-server, an explicit HARNESS_URL + HARNESS_CHARACTER pair
can replace the phone's saved connection.

Optional environment: DEVICE_NAME, DEVICE_UDID, CONFIG, SKIP_ENGINE=1,
TEAM_ID (override signing team for this build only), NODE_BINARY,
HARNESS_IOS_HOST (Mac hostname/IP override), PORT (default 8788).
Logs: app_swift/build/iphone/
USAGE
}

step() { STAGE="$1"; printf '\n==> %s\n' "$STAGE"; }
fail() { printf '\nError: %s\n' "$*" >&2; exit 1; }
trap 'status=$?; printf "\nFailed during %s (exit %s). Logs: %s\n" "$STAGE" "$status" "$BUILD_ROOT" >&2; exit "$status"' ERR

while [ "$#" -gt 0 ]; do
  case "$1" in
    --console) CONSOLE=1 ;;
    --skip-engine) SKIP_ENGINE=1 ;;
    --build-only) BUILD_ONLY=1 ;;
    --list-devices) LIST_DEVICES=1 ;;
    --restart-server) RESTART_SERVER=1 ;;
    -d|--device|--configuration)
      [ "$#" -ge 2 ] && [ -n "$2" ] || fail "$1 needs a value (see --help)."
      case "$1" in
        --configuration) CONFIG="$2" ;;
        *) DEVICE_SELECTOR="$2" ;;
      esac
      shift ;;
    --device=*) DEVICE_SELECTOR="${1#*=}"; [ -n "$DEVICE_SELECTOR" ] || fail "--device needs a value." ;;
    -h|--help) usage; exit 0 ;;
    *) fail "Unknown option: $1 (see --help)." ;;
  esac
  shift
done

case "$CONFIG" in Debug|Release) ;; *) fail "Configuration must be Debug or Release." ;; esac
case "$SKIP_ENGINE" in 0|1) ;; *) fail "SKIP_ENGINE must be 0 or 1." ;; esac
if [ "$RESTART_SERVER" -eq 1 ]; then
  [ "$BUILD_ONLY" -eq 0 ] && [ "$LIST_DEVICES" -eq 0 ] || fail "--restart-server cannot be combined with --build-only or --list-devices."
  [ -z "${HARNESS_URL:-}" ] && [ -z "${HARNESS_CHARACTER:-}" ] || fail "Use HARNESS_IOS_HOST with --restart-server instead of HARNESS_URL/HARNESS_CHARACTER."
  command -v "${NODE_BINARY:-node}" >/dev/null 2>&1 || fail "--restart-server requires Node >=23.6 (set NODE_BINARY if needed)."
fi
[ "$(uname -s)" = Darwin ] || fail "This script requires macOS and Xcode."
for tool in xcrun xcodebuild python3; do
  command -v "$tool" >/dev/null 2>&1 || fail "$tool is missing. Install full Xcode and its command-line tools."
done
if [ ! -d "$PROJECT" ] || [ "$SCRIPT_DIR/project.yml" -nt "$PROJECT/project.pbxproj" ]; then
  command -v xcodegen >/dev/null 2>&1 || fail "The Xcode project is missing and XcodeGen is not installed. Install XcodeGen or generate the project from app_swift/project.yml."
  step "Generating the Xcode project from project.yml"
  python3 "$LAB_ROOT/tools/generate-ios-project.py"
fi
if [ -n "${HARNESS_URL:-}" ] || [ -n "${HARNESS_CHARACTER:-}" ]; then
  [ -n "${HARNESS_URL:-}" ] && [ -n "${HARNESS_CHARACTER:-}" ] || fail "Supply both HARNESS_URL and HARNESS_CHARACTER, or neither to use the saved session."
fi
mkdir -p "$BUILD_ROOT"

if [ "$LIST_DEVICES" -eq 1 ] || [ "$BUILD_ONLY" -eq 0 ]; then
  step "Finding physical iPhones"
  if ! xcrun devicectl list devices --timeout 30 --json-output "$BUILD_ROOT/devices.json" >"$BUILD_ROOT/devices.log" 2>&1; then
    cat "$BUILD_ROOT/devices.log" >&2
    fail "Could not list devices. Connect/unlock your iPhone and check Xcode > Window > Devices and Simulators."
  fi
  DEVICE_UDID="$(python3 - "$BUILD_ROOT/devices.json" "$DEVICE_SELECTOR" "$LIST_DEVICES" <<'PY'
import json
import sys

with open(sys.argv[1]) as source:
    data = json.load(source)
devices = []
for device in data.get("result", {}).get("devices", []):
    properties = device.get("properties", {})
    hardware = properties.get("hardware", device.get("hardwareProperties", {}))
    state = properties.get("state", device.get("deviceProperties", {}))
    connection = properties.get("connection", device.get("connectionProperties", {}))
    if hardware.get("reality") != "physical" or hardware.get("deviceType") != "iPhone":
        continue
    if connection.get("pairingState") != "paired":
        continue
    devices.append({
        "id": hardware.get("udid") or device.get("identifier", ""),
        "core_id": device.get("identifier", ""),
        "name": state.get("name", "iPhone"),
        "connected": connection.get("state", connection.get("tunnelState")) == "connected",
    })

for device in devices:
    status = "connected" if device["connected"] else "paired"
    print(f'  {device["name"]} | {device["id"]} | {status}', file=sys.stderr)
if sys.argv[3] == "1":
    sys.exit(0)
selector = sys.argv[2].casefold()
matches = [d for d in devices if selector in (d["id"].casefold(), d["core_id"].casefold(), d["name"].casefold())] if selector else devices
if not selector:
    connected = [d for d in matches if d["connected"]]
    if len(connected) == 1:
        matches = connected
if len(matches) != 1:
    print("Select exactly one paired iPhone with --device <name-or-id>. Connect, unlock and trust it first.", file=sys.stderr)
    sys.exit(1)
print(matches[0]["id"])
PY
  )"
  [ "$LIST_DEVICES" -eq 0 ] || exit 0
fi

if [ "$SKIP_ENGINE" -eq 0 ]; then
  step "Building Kaigen framework and checking world assets"
  "$LAB_ROOT/build-engine.sh" --configuration "$CONFIG" 2>&1 | tee "$BUILD_ROOT/engine.log"
else
  step "Reusing existing Kaigen framework and cooked assets"
  python3 "$LAB_ROOT/tools/ios-artifacts.py" check --configuration "$CONFIG"
fi

step "Building and signing SwiftUI app ($CONFIG)"
DESTINATION="generic/platform=iOS"
[ "$BUILD_ONLY" -eq 1 ] || DESTINATION="id=$DEVICE_UDID"
XCODE_ARGS=(-allowProvisioningUpdates -project "$PROJECT" -scheme "$SCHEME" -configuration "$CONFIG"
  -destination "$DESTINATION" -derivedDataPath "$DERIVED_DATA")
[ -z "${TEAM_ID:-}" ] || XCODE_ARGS+=("DEVELOPMENT_TEAM=$TEAM_ID")
# Use saved Xcode signing; generating the project would discard its team setting.
xcodebuild "${XCODE_ARGS[@]}" build 2>&1 | tee "$BUILD_ROOT/xcode.log"
APP="$DERIVED_DATA/Build/Products/$CONFIG-iphoneos/$SCHEME.app"
[ -d "$APP" ] || fail "Xcode did not produce $APP."
codesign --verify --strict "$APP"
if [ "$BUILD_ONLY" -eq 1 ]; then
  printf '\nBuilt and signed: %s\n' "$APP"
  exit 0
fi

if [ "$RESTART_SERVER" -eq 1 ]; then
  step "Restarting conversation server with current voice and prompt"
  "${NODE_BINARY:-node}" "$LAB_ROOT/tools/restart-harness.mjs" "$BUILD_ROOT/session.json"
  HARNESS_URL="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["url"])' "$BUILD_ROOT/session.json")"
  HARNESS_CHARACTER="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["character"])' "$BUILD_ROOT/session.json")"
fi

step "Installing on iPhone"
xcrun devicectl device install app --device "$DEVICE_UDID" "$APP" 2>&1 | tee "$BUILD_ROOT/install.log"
step "Opening Kloey Companion Lab"
LAUNCH_ARGS=(--terminate-existing --device "$DEVICE_UDID")
[ "$CONSOLE" -eq 0 ] || LAUNCH_ARGS+=(--console)
if [ -n "${HARNESS_URL:-}" ]; then
  export DEVICECTL_CHILD_HARNESS_URL="$HARNESS_URL"
  export DEVICECTL_CHILD_HARNESS_CHARACTER="$HARNESS_CHARACTER"
fi
export DEVICECTL_CHILD_MTL_DEBUG_LAYER=0
xcrun devicectl device process launch "${LAUNCH_ARGS[@]}" "$BUNDLE_ID" 2>&1 | tee "$BUILD_ROOT/launch.log"
printf '\nApp launched. Voice uses the saved connection and the running harness.\n'
