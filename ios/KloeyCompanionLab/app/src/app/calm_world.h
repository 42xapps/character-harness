#pragma once
#include "ecs/ecs.h"
#include "assets/assets.h"
#include "physics/physics.h"

HZ_REFLECT()
HZ_STRUCT_TYPEDEF(CalmCollisionTriangle) { i32 a, b, c; };

HZ_REFLECT()
HZ_STRUCT_TYPEDEF(CalmCollisionMeshBlobAsset) {
  BlobAssetHeader header;
  BlobArray(v3) vertices;
  BlobArray(CalmCollisionTriangle) triangles;
};

HZ_REFLECT()
HZ_STRUCT_TYPEDEF(CalmWorldBlobAsset) {
  BlobAssetHeader header;
  BlobAssetRef(CalmCollisionMeshBlobAsset) ground;
  BlobAssetRef(CalmCollisionMeshBlobAsset) solid;
};

typedef struct CalmWorldState {
  HzHandleT(CalmWorldBlobAsset) asset;
  b32 ready;
} CalmWorldState;
ECS_COMPONENT_TYPEDEF(CalmWorldState);

void calm_world_init(EcsWorld *w);
void calm_world_update(EcsWorld *w);
