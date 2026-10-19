"""Check or deliberately refresh the iOS copies of canonical player helpers."""
import argparse
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FILES = ('app_character.c', 'app_character.h', 'app_emote_clips.c',
         'player_json.c', 'player_json.h', 'player_vrm.c', 'player_vrm.h')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument('--check', action='store_true', help='Fail on drift (the default)')
    mode.add_argument('--write', action='store_true', help='Copy these seven files from player/src/app')
    args = parser.parse_args()
    pairs = [(ROOT.parents[1] / 'player/src/app' / name, ROOT / 'app/src/app' / name) for name in FILES]
    if any(not source.is_file() for source, _ in pairs):
        parser.exit(1, 'A canonical player helper is missing; synchronization stopped.\n')
    drift = []
    for source, local in pairs:
        contents = source.read_bytes()
        if local.is_file() and local.read_bytes() == contents:
            continue
        if args.write:
            temporary = local.with_suffix('.sync.tmp')
            temporary.write_bytes(contents)
            temporary.replace(local)
            print(f'Updated {local.relative_to(ROOT)}')
        else:
            drift.append(local.name)
    if drift:
        parser.exit(1, 'Shared player source drift: ' + ', '.join(drift) +
                    '. Refresh deliberately with tools/sync-player-helpers.py --write.\n')
    print('Shared player helpers: no drift.')


if __name__ == '__main__':
    main()
