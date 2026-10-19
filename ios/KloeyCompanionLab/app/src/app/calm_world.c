#include "app/calm_world.h"
#include "ecs/ecs_physics/ecs_physics.h"
#include "lib/thread_context.h"

hz_internal AssetDepsResult calm_world_deps(u8 *raw, u32 len, b32 stream, Allocator *alloc) {
  UNUSED(len);
  UNUSED(stream);
  CalmWorldBlobAsset *world = (CalmWorldBlobAsset *)raw;
  AssetDepEntry *deps = ALLOC_ARRAY(alloc, AssetDepEntry, 2);
  deps[0] = (AssetDepEntry){.path = string_blob_get(&world->ground.path), .type_id = world->ground.typehash};
  deps[1] = (AssetDepEntry){.path = string_blob_get(&world->solid.path), .type_id = world->solid.typehash};
  return (AssetDepsResult){.entries = deps, .count = 2};
}

hz_internal void *calm_world_loader(AssetLoadContext *ctx) {
  CalmWorldBlobAsset *world = (CalmWorldBlobAsset *)ctx->raw_buffer;
  assert(ctx->dependency_count == 2);
  world->ground.handle = HANDLE_CAST(HzHandle, ctx->dependencies[0]);
  world->solid.handle = HANDLE_CAST(HzHandle, ctx->dependencies[1]);
  return world;
}

void calm_world_init(EcsWorld *w) {
  AssetSystem *assets = ecs_resource_get_mut(w, AssetSystem);
  asset_register_loader(assets, ASSET_TYPE(CalmWorldBlobAsset), calm_world_loader, calm_world_deps);
  ecs_resource_set(w, CalmWorldState, {.asset = asset_load(CalmWorldBlobAsset, assets,
    .path = "environments/quaternius/collision.hzt")});
}

hz_internal void calm_world_body(EcsWorld *w, AssetSystem *assets, CalmCollisionMeshBlobAsset *source, u32 category) {
  Array(v3) v = blob_array_get(v3, &source->vertices);
  Array(CalmCollisionTriangle) triangles = blob_array_get(CalmCollisionTriangle, &source->triangles);
  if (!v.len || !triangles.len) return;
  TriMeshColliderBlob *mesh = NULL;
  tctx_temp_allocator_scope(ta, NULL) {
    i32 *indices = ALLOC_ARRAY(&ta.allocator, i32, triangles.len * 3);
    for (u32 i = 0; i < triangles.len; i++) {
      indices[i * 3] = triangles.items[i].a;
      indices[i * 3 + 1] = triangles.items[i].b;
      indices[i * 3 + 2] = triangles.items[i].c;
    }
    mesh = trimesh_blob_build(v.items, indices, (i32)triangles.len, &assets->allocator);
  }
  EcsEntity entity = ecs_entity_create(w);
  ecs_component_set(w, entity, ColliderBody, {.collider = collider_trimesh(mesh), .rot = quat_identity(),
    .scale = 1, .filter = {.category = category, .mask = ~0u}});
  ecs_component_add(w, entity, StaticBody);
}

void calm_world_update(EcsWorld *w) {
  CalmWorldState *state = ecs_resource_get_mut(w, CalmWorldState);
  AssetSystem *assets = ecs_resource_get_mut(w, AssetSystem);
  if (state->ready || !asset_is_ready(assets, state->asset)) return;
  CalmWorldBlobAsset *world = asset_get(assets, state->asset, CalmWorldBlobAsset);
  calm_world_body(w, assets, blob_asset_ref_get(CalmCollisionMeshBlobAsset, assets, &world->ground), 1);
  calm_world_body(w, assets, blob_asset_ref_get(CalmCollisionMeshBlobAsset, assets, &world->solid), 2);
  state->ready = true;
  log_info("calm world: authored ground and solid collision ready");
}
