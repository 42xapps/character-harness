#!/usr/bin/env bash
# Native iOS checks; never builds a desktop or web player.
set -euo pipefail
lab_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$lab_root"
mkdir -p app_swift/build/ios-checks
python3 tools/check-ios-contracts.py
python3 tools/generate-ios-project.py
for configuration in Debug Release; do
  ./build-engine.sh --configuration "$configuration" >"app_swift/build/ios-checks/engine-$configuration.log" 2>&1
  python3 tools/ios-artifacts.py check --configuration "$configuration"
  python3 tools/stage-ios-assets.py
  xcodebuild -project app_swift/KloeyCompanionLab.xcodeproj -scheme KloeyCompanionLab \
    -configuration "$configuration" -destination 'generic/platform=iOS' \
    -derivedDataPath app_swift/build/ios-checks/derived CODE_SIGNING_ALLOWED=NO build \
    >"app_swift/build/ios-checks/xcode-$configuration.log" 2>&1
done
