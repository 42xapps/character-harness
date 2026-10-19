"""Keep the checked-in iOS todo list and its evidence in one place."""
from pathlib import Path
import argparse
import datetime
import hashlib
import json

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("item", nargs="?")
    parser.add_argument("--status")
    parser.add_argument("--read", action="append", default=[])
    parser.add_argument("--change", action="append", default=[])
    parser.add_argument("--evidence", action="append", default=[])
    parser.add_argument("--remaining", action="append", default=[])
    parser.add_argument("--clear-remaining", action="store_true")
    args = parser.parse_args()
    path = ROOT / "ios-progress.json"
    data = json.loads(path.read_text())
    if args.item:
        item = next((i for i in data["items"] if i["id"] == args.item), None)
        if item is None:
            parser.error("Unknown item")
        if args.status:
            if args.status not in data["status_values"]:
                parser.error("Unknown status")
            item["status"] = args.status
        for reference in args.read:
            file = ROOT / reference.split("#", 1)[0]
            record = {"reference": reference, "reviewed_at": datetime.datetime.now(datetime.timezone.utc).isoformat()}
            if file.is_file():
                record["sha256"] = hashlib.sha256(file.read_bytes()).hexdigest()
            elif not reference.startswith("https://"):
                parser.error(f"Missing guidance file: {reference}")
            item["guidance"].append(record)
        item["changes"].extend(args.change)
        item["evidence"].extend(args.evidence)
        if args.clear_remaining:
            item["remaining"] = []
        if args.remaining:
            item["remaining"] = args.remaining
        if item["status"] == "verified" and (item["remaining"] or not item["evidence"]):
            parser.error("Verification requires evidence and no remaining acceptance work")
    data["updated_at"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
    path.write_text(json.dumps(data, indent=2) + "\n")
    lines = ["# iOS implementation tracker", "", data["scope"], "",
             "Source: [saved audit](" + data["audit"] + "). Engine: `" + data["engine"] + "`.", "",
             "Current results: [validation report](" + data["validation"] + ").", "",
             "Review range: `" + data["baseline"][:7] + "` → `" + data["implementation_start"][:7] + "`; remediation and evidence are tracked below.", "",
             "`implemented` means code is in place. `verified` means the recorded acceptance passed. Outstanding device/CI work stays listed until it passes.", "",
             "The JSON file is the source of truth. Update with `python3 tools/ios-progress.py <id> ...`.", "",
             "| Step | Status | Work |", "|---|---|---|"]
    for item in data["items"]:
        lines.append(f"| {item['id']} | {item['status']} | {item['title']} |")
    lines += ["", "**Excluded by the user**", ""] + ["- " + v for v in data["excluded"]]
    for item in data["items"]:
        lines += ["", f"**{item['id']}. {item['title']} — {item['status']}**", "",
                  "Audit mapping: " + item["source"] + ".", "", "Acceptance: " + item["acceptance"]]
        for name in ["guidance", "changes", "evidence", "remaining"]:
            if item[name]:
                lines += ["", name.capitalize() + ":", ""]
                lines.extend("- " + (v["reference"] if isinstance(v, dict) else v) for v in item[name])
    lines += ["", "**Notes**", ""] + ["- " + v for v in data["notes"]]
    (ROOT / "IOS-WORK.md").write_text("\n".join(lines) + "\n")


if __name__ == "__main__":
    main()
