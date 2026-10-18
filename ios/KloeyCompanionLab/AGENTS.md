# KloeyCompanionLab — agent notes

This repo is a Kaigen engine project WITH a native SwiftUI iOS host. One git
repo, two subdirs. Read this before running anything.

## Layout

- `app/` — the engine project (C, cross-platform). The build CLI is
  `app/hz/hzbuild` (`app/hz` symlinks the pinned engine install). **There is no
  `hzbuild` at this repo root.** Every `./hzbuild ...` you see in the engine
  skills or in `app/AGENTS.md` means `hz/hzbuild ...` run from inside `app/`.
- `app_swift/` — the SwiftUI iOS host that ships to the phone. No engine code.
  Read `app_swift/AGENTS.md` before touching it.

The engine documentation is under `app/hz/AGENTS.md`, `app/hz/.claude/skills/`
and `app/hz/wiki/`. Read the relevant core/build/game/shader guidance for C work.

## Running

| Goal | Command |
|---|---|
| On this Mac | `cd app && hz/hzbuild macos run` |
| **On a real iPhone (the app that ships)** | `cd app_swift && ./run.sh` |
| Screenshot from the device | `cd app_swift && ./shot.sh "wait 3; shot scene"` → `build/shots/scene.png` |
| Device logs | `cd app_swift && ./run.sh --console` |
| Swift-only change (skip the engine rebuild) | `cd app_swift && ./run.sh --skip-engine` |

`hzbuild wasm ios` is the **mobile-web** profile — Safari/WebGPU,
single-threaded, a compatibility check. It is NOT the app that ships on the
phone. For the real iPhone app always use `app_swift/run.sh`.

## Host <-> engine messages

The two halves talk over a fixed-size POD message channel. The engine side
lives in `app/src/app_swift/` — start at `app/src/app_swift/app_swift.h`,
which documents the whole contract. Adding a message means editing four files
in lockstep; `app_swift/AGENTS.md` lists them.

## Calm activity

Read IDLE-LIFE.md before changing movement, animation or camera ownership.
Use gameplay_blocks character movement and fixed-step interpolation; keep
locomotion's bone mask away from face/accessory/cloth controls. All per-entity
activity state is CalmLife; voice/lifecycle input is CalmLifeInput. Preserve
voice priority and the existing harness performance channels. The physical
walking corridor is deliberately bounded to the verified flat part of the
rendered scene. Run tools/verify-life-space.py when changing the world/routes.
The extra foot-planting pass is not enabled: it distorted the skirt in rendered
checks. Do not silently enable it without resolving and visually testing that
interaction. Never edit the shared engine drop.
