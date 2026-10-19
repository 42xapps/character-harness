"""Stage the native iOS asset closure without modifying the development cook or SDK."""
import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import shutil
from ios_asset_closure import CookedAssets

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--destination', type=Path, default=ROOT / 'app/out/ios-resources/cooked')
    args = parser.parse_args()
    plan = json.loads((ROOT / 'ios-assets.json').read_text())
    assets = CookedAssets(ROOT / 'app')
    seeds = list(plan['roots'])
    for pattern in plan['dynamic_groups'] + plan['shader_groups']:
        seeds.extend(p.relative_to(assets.root).as_posix() for p in assets.root.glob(pattern))
    selected = assets.closure(seeds)
    total = sum((assets.root / name).stat().st_size for name in selected)
    if total > plan['budget_bytes']:
        parser.exit(1, f'iOS resources exceed budget: {total} > {plan["budget_bytes"]} bytes\n')
    destination = args.destination.resolve()
    if destination == assets.root.resolve() or assets.root.resolve() in destination.parents or destination in ROOT.parents or destination == ROOT:
        parser.error('Destination must be outside the development cook')
    report_path = destination.parent / 'ios-assets-report.json'
    previous = set()
    if report_path.is_file():
        report = json.loads(report_path.read_text())
        if report.get('schema') != 1:
            parser.error('Unrecognized staging report')
        for entry in report['files']:
            name = entry['path']
            path = PurePosixPath(name)
            if path.is_absolute() or '..' in path.parts or not name:
                parser.error('Unsafe path in previous staging report')
            previous.add(path.as_posix())
    destination.mkdir(parents=True, exist_ok=True)
    existing = {p.relative_to(destination).as_posix() for p in destination.rglob('*') if p.is_file()}
    if existing - previous - selected:
        parser.error('Destination contains files not owned by the iOS staging report')
    for name in existing | selected | previous:
        if destination not in (destination / name).resolve().parents:
            parser.error('Staging destination contains an external symlink')
    for name in previous - selected:
        (destination / name).unlink(missing_ok=True)
    records = []
    for name in sorted(selected):
        source, target = assets.root / name, destination / name
        checksum = hashlib.sha256(source.read_bytes()).hexdigest()
        target.parent.mkdir(parents=True, exist_ok=True)
        if not target.exists() or hashlib.sha256(target.read_bytes()).hexdigest() != checksum:
            shutil.copy2(source, target)
        records.append({'path': name, 'bytes': source.stat().st_size, 'sha256': checksum})
    report = {'schema': 1, 'files': records, 'bytes': total, 'budget_bytes': plan['budget_bytes'],
              'development_cook_bytes': sum(p.stat().st_size for p in assets.root.rglob('*') if p.is_file()),
              'engine': (ROOT / 'app/hz/hzsdk.hzt').read_text()}
    temporary = report_path.with_suffix('.tmp')
    temporary.write_text(json.dumps(report, indent=2) + '\n')
    temporary.replace(report_path)
    print(f'iOS resources: {total / 1048576:.2f} MiB in {len(records)} files; report: {report_path}')


if __name__ == '__main__':
    main()
