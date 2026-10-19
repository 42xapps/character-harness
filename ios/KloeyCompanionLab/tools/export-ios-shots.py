"""Export named driver captures, requiring every requested screenshot."""
import argparse
import json
from pathlib import Path
import re
import shutil


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory", type=Path)
    parser.add_argument("commands")
    args = parser.parse_args()
    expected = []
    for command in args.commands.split(";"):
        words = command.strip().split(maxsplit=1)
        if words and words[0] == "shot":
            name = words[1].strip() if len(words) == 2 else "shot"
            if not re.fullmatch(r"[A-Za-z0-9_-]+", name) or name in expected:
                parser.error("Screenshot names must be unique letters, numbers, '_' or '-'.")
            expected.append(name)
    try:
        groups = json.loads((args.directory / "manifest.json").read_text())
        found = set()
        for group in groups:
            for attachment in group.get("attachments", []):
                exported = attachment.get("exportedFileName", "")
                source = args.directory / exported
                if Path(exported).name != exported or not source.is_file():
                    continue
                suggested = attachment.get("suggestedHumanReadableName", "")
                for name in expected:
                    # xcresult appends a repetition number and attachment UUID.
                    # Match that suffix exactly: "scene_more" must not satisfy "scene".
                    suffix = r"(?:_\d+_[0-9A-Fa-f-]{36})?\.png"
                    if re.fullmatch(re.escape(name) + suffix, suggested):
                        target = args.directory / (name + ".png")
                        if source.resolve() != target.resolve():
                            shutil.copyfile(source, target)
                        found.add(name)
        missing = set(expected) - found
        if missing:
            parser.exit(1, "Missing captures: " + ", ".join(sorted(missing)) + "\n")
        for name in expected:
            print(args.directory / (name + ".png"))
    except (OSError, ValueError) as error:
        parser.exit(1, f"Cannot export screenshots: {error}\n")


if __name__ == "__main__":
    main()
