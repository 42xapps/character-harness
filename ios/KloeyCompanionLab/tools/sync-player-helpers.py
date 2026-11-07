"""Check or deliberately refresh the iOS copies of canonical player helpers."""
import argparse
import hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FILES = ('app_character.c', 'app_character.h', 'app_emote_clips.c',
         'player_json.c', 'player_json.h', 'player_vrm.c', 'player_vrm.h')
# Desktop and iOS use different SDK versions. Detect changes on either side
# until these helpers are deliberately ported and the pins are reunited.
VERSIONED = {
    'app_character.c': ('b8eab54a752375b04aeb7490a1f483d1aaa8c4857af3b1e430abec2c8724b15c', '629464edd531d4bbe326868128d72cefeaa1737980ce79aa5a9fa149e6b4b4db'),
    'app_emote_clips.c': ('0fee3c4f722b227fe35722df5f7303f26abf0d44053fa1178bb533c329a5d319', '6e08dfa9e813a659ec2ab91e6cd50032caf6fc5ed40290dde225d197b84c9529'),
    'player_vrm.c': ('3613bb52ed9fd29deb628116162d00c3e082e940bed1e790fc513b5c817db49d', '5d10394835697571c8e38668d6ad4d508d1a02c89a780febd598bd2b5c99626a'),
}


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
        expected = VERSIONED.get(source.name)
        if expected and local.is_file():
            current = (hashlib.sha256(contents).hexdigest(), hashlib.sha256(local.read_bytes()).hexdigest())
            if current == expected:
                continue
            drift.append(local.name + ' (SDK-specific; review both versions)')
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
