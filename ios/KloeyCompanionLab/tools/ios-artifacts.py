"""Bind reusable native iOS artifacts to their configuration, inputs and bytes."""
import argparse
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "app"
STAMP = APP / "out/ios-framework/build-stamp.json"


def digest(paths):
    result = hashlib.sha256()
    files = []
    for path in paths:
        if not path.exists():
            raise ValueError(f"Missing build input/output: {path}")
        files.extend(path.rglob("*") if path.is_dir() else [path])
    for path in sorted(p for p in files if p.is_file()):
        result.update(str(path.relative_to(ROOT)).encode())
        result.update(b"\0")
        with path.open("rb") as source:
            for chunk in iter(lambda: source.read(1024 * 1024), b""):
                result.update(chunk)
        result.update(b"\0")
    return result.hexdigest()


def snapshot(configuration):
    return {
        "schema": 1,
        "configuration": configuration,
        "sdk": (APP / "hz/hzsdk.hzt").read_text(),
        "inputs": digest([APP / p for p in ("src", "assets", "shaders", "hzproject.hzt")] +
                         [ROOT / "build-engine.sh", Path(__file__)]),
        "outputs": digest([APP / "out/ios-framework/HZEngine.xcframework", APP / "cooked"]),
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=["invalidate", "record", "check"])
    parser.add_argument("--configuration", choices=["Debug", "Release"], default="Debug")
    args = parser.parse_args()
    if args.action == "invalidate":
        STAMP.unlink(missing_ok=True)
        return
    try:
        current = snapshot(args.configuration)
        if args.action == "check":
            if not STAMP.is_file() or json.loads(STAMP.read_text()) != current:
                raise ValueError("Engine package is stale, modified or from a different configuration. "
                                 "Build again without --skip-engine.")
            print(f"Verified {args.configuration} iOS engine package.")
        else:
            STAMP.parent.mkdir(parents=True, exist_ok=True)
            temporary = STAMP.with_suffix(".tmp")
            temporary.write_text(json.dumps(current, indent=2) + "\n")
            temporary.replace(STAMP)
            print(f"Recorded {args.configuration} iOS engine package.")
    except (OSError, ValueError) as error:
        parser.exit(1, f"{error}\n")


if __name__ == "__main__":
    main()
