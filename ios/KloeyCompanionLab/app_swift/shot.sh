#!/usr/bin/env bash
#
# Drive the app autonomously on the device and pull screenshots. Runs the
# generic XCUITest driver (UITests/Driver.swift) with a command script, then
# extracts the captured screenshots from the .xcresult into build/shots/.
#
#   ./shot.sh "wait 2; shot scene"
#   ./shot.sh "tapId PingButton; wait 0.5; shot after_ping"
#   ./shot.sh "tap 0.5,0.4; shot after_tap"      # tap the engine area (normalized)
#
# Commands (';'-separated): wait <s> | tap <nx>,<ny> | tapId <id> | type <text> | shot <name>
#
# Each `shot` is a full-screen XCUIScreen capture (engine 3D + SwiftUI + keyboard).
# Requires the iOS platform component (one-time): xcodebuild -downloadPlatform iOS
# Signing is manual and never hardcoded: SIGN_ID/PROFILE from the env win,
# otherwise `hzbuild ios provision --print` (run in ../app) resolves them;
# profile name/UUID/team are decoded from the profile itself.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$SCRIPT_DIR/../app"
SCHEME="KloeyCompanionLab"
BUNDLE_ID="com.kaigen.kloeycompanionlab"
CMDS="${1:-${CMDS:-wait 2; shot default}}"
RESULT="$SCRIPT_DIR/build/test.xcresult"
SHOTS="$SCRIPT_DIR/build/shots"

step() { printf "\n\033[1;36m==> %s\033[0m\n" "$1"; }
fail() { printf "\033[1;31merror: %s\033[0m\n" "$1" >&2; exit 1; }

if [ -x "$APP_DIR/hz/hzbuild" ]; then
  HZBUILD="$APP_DIR/hz/hzbuild"
elif [ -x "$APP_DIR/hzbuild" ]; then
  HZBUILD="$APP_DIR/hzbuild"
else
  HZBUILD="hzbuild"
fi

SIGN_ID="${SIGN_ID:-}"
PROFILE="${PROFILE:-}"
if [ -z "$SIGN_ID" ] || [ -z "$PROFILE" ]; then
  PROV_OUT="$( ( cd "$APP_DIR" && "$HZBUILD" ios provision --print ) 2>&1 || true )"
  PROV_JSON="$(printf '%s\n' "$PROV_OUT" | sed -n 's/.*\({"bundle_id".*}\).*/\1/p' | tail -1)"
  if [ -z "$PROV_JSON" ]; then
    printf '%s\n' "$PROV_OUT" >&2
    fail "no iOS signing material — connect your iPhone and run '$HZBUILD ios provision --print' inside ../app to auto-provision, then re-run"
  fi
  PROV_FILE="$(mktemp -t hzprov)"
  printf '%s' "$PROV_JSON" > "$PROV_FILE"
  PROV_BUNDLE="$(plutil -extract bundle_id raw -o - "$PROV_FILE")"
  [ "$PROV_BUNDLE" = "$BUNDLE_ID" ] || fail "provisioned bundle id '$PROV_BUNDLE' != '$BUNDLE_ID'"
  [ -n "$SIGN_ID" ] || SIGN_ID="$(plutil -extract signing_identity raw -o - "$PROV_FILE")"
  [ -n "$PROFILE" ] || PROFILE="$(plutil -extract profile_path raw -o - "$PROV_FILE")"
  rm -f "$PROV_FILE"
fi
[ -n "$SIGN_ID" ] || fail "no Apple Development signing identity (set SIGN_ID)"
[ -f "$PROFILE" ] || fail "provisioning profile not found: $PROFILE (set PROFILE)"

# read profile metadata + install it where xcodebuild looks
PLIST="$(mktemp)"; security cms -D -i "$PROFILE" -o "$PLIST" 2>/dev/null || fail "cannot decode $PROFILE"
PROF_NAME="$(plutil -extract Name raw -o - "$PLIST")"
PROF_UUID="$(plutil -extract UUID raw -o - "$PLIST")"
PROF_TEAM="$(plutil -extract TeamIdentifier.0 raw -o - "$PLIST")"
rm -f "$PLIST"
mkdir -p "$HOME/Library/MobileDevice/Provisioning Profiles"
cp "$PROFILE" "$HOME/Library/MobileDevice/Provisioning Profiles/$PROF_UUID.mobileprovision"

[ -d "$APP_DIR/out/ios-framework/HZEngine.xcframework" ] || { step "Building engine framework"; ( cd "$APP_DIR" && "$HZBUILD" ios --framework ); }
step "Generating Xcode project"
command -v xcodegen >/dev/null 2>&1 || fail "xcodegen not installed (brew install xcodegen)"
( cd "$SCRIPT_DIR" && xcodegen generate )

if [ -n "${DEVICE_UDID:-}" ]; then
  DEV="$DEVICE_UDID"
else
  DEV="$(xcrun devicectl list devices 2>/dev/null \
        | grep -i "${DEVICE_NAME:-iPhone}" | grep -iv "unavailable" \
        | grep -oE '[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}' \
        | head -1 || true)"
fi
[ -n "$DEV" ] || { echo; xcrun devicectl list devices; fail "no matching device (set DEVICE_NAME or DEVICE_UDID)"; }

step "Running UI driver on $DEV  (team $PROF_TEAM, profile '$PROF_NAME')"
echo "CMDS: $CMDS"
rm -rf "$RESULT" "$SHOTS"
set +e
TEST_RUNNER_CMDS="$CMDS" xcodebuild test \
  -project "$SCRIPT_DIR/$SCHEME.xcodeproj" -scheme "$SCHEME" \
  -destination "platform=iOS,id=$DEV" \
  -resultBundlePath "$RESULT" \
  CODE_SIGN_STYLE=Manual CODE_SIGN_IDENTITY="$SIGN_ID" \
  PROVISIONING_PROFILE_SPECIFIER="$PROF_NAME" DEVELOPMENT_TEAM="$PROF_TEAM" \
  -quiet
TEST_RC=$?
set -e
[ $TEST_RC -eq 0 ] || echo "(xcodebuild test exited $TEST_RC — extracting any captured shots anyway)"

step "Extracting screenshots -> $SHOTS"
mkdir -p "$SHOTS"
if xcrun xcresulttool export attachments --path "$RESULT" --output-path "$SHOTS" >/dev/null 2>&1 \
   && [ -f "$SHOTS/manifest.json" ]; then
  /usr/bin/python3 - "$SHOTS" <<'PY' 2>/dev/null || true
import json, os, sys, shutil
d = sys.argv[1]
for grp in json.load(open(os.path.join(d, "manifest.json"))):
    for a in grp.get("attachments", []):
        src = os.path.join(d, a.get("exportedFileName", ""))
        sug = a.get("suggestedHumanReadableName", "")
        if not (src and os.path.exists(src) and sug): continue
        base = sug[:-4] if sug.endswith(".png") else sug
        name = "_".join(base.split("_")[:-2]) or base
        shutil.copyfile(src, os.path.join(d, name + ".png"))
PY
  ls -1 "$SHOTS"/*.png 2>/dev/null | grep -vE '/[0-9A-F-]{36}\.png$' | sed "s#^#  #"
  printf "\033[1;32mshots in %s\033[0m\n" "$SHOTS"
else
  echo "no attachments extracted; inspect $RESULT"
fi
