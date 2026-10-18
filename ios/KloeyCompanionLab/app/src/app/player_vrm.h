#pragma once
#include "lib/typedefs.h"

#define PLAYER_VRM_PATH_MAX 256

// What the player needs to show an imported character.
typedef struct {
  char profile[PLAYER_VRM_PATH_MAX];  // the character profile (app_character_set)
  char gestures[PLAYER_VRM_PATH_MAX]; // its gesture set; empty when it has none
  b32 animated; // has an idle clip; false = the body holds its bind pose
} PlayerVrm;

// Turns a .vrm (or a .glb with a VRM humanoid) into a character the player
// can spawn, at runtime, with no offline cook. Writes the imported
// model, its clips and a generated character profile under cooked/vrm/<name>/.
// The first load imports and caches; later loads reuse the cache until the
// file changes. False on failure.
b32 player_vrm_load(CString vrm_path, PlayerVrm *out);
