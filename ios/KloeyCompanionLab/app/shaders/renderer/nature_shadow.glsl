#define HZ_RENDERER_ALPHA_CUTOUT
#define HZ_RENDERER_SHADOW_PASS
#include "renderer.glsl"
#include "nature_wind_common.glsl"

@vs
#define HZ_RENDERER_VERTEX_SHADER
#define HZ_RENDERER_SKINNED   // pulls in hz_bones + apply_skinning
#include "renderer_shaders.glsl"
out vec2 v_uv;
flat out uint v_material_offset;

void main() {
    ShadowPassInstance s = unpack_shadow_pass_instance_data();
    vec3 pos     = s.v.pos;
    vec3 normal  = s.v.normal;
    vec3 tangent = s.v.tangent;

    // 0xFFFFFFFFu = static; matches the renderer's static-instantiate sentinel.
    if (s.v.bone_offset != 0xFFFFFFFFu) {
        apply_skinning(pos, normal, tangent, s.v.bone_offset, s.v.vertex_base, s.v.vertex_layout_flags);
    }

    v_uv = s.v.uv;
    v_material_offset = s.v.material_offset;

    vec3 world_pos = nature_wind_position(s.v.model * vec4(pos, 1.0), s.v.color, nature_wind_frame.times.x).xyz;
    vec3 world_normal = normalize(mat3(s.v.model) * normal);
    world_pos = apply_shadow_bias(world_pos, world_normal, s.cascade);
    gl_Position = apply_shadow_clamping(hz_shadow_pass.light_view_proj[s.cascade] * vec4(world_pos, 1.0));
#ifndef SHADER_BACKEND_WGSL
    gl_ViewportIndex = int(s.cascade);
#endif
}
@end

@fs
#undef HZ_RENDERER_VERTEX_SHADER
#define HZ_RENDERER_FRAGMENT_SHADER
#include "renderer_shaders.glsl"
in vec2 v_uv;
flat in uint v_material_offset;
layout(location = 0) out vec4 frag_color;

@material
struct MaterialFS {
    vec4 color;
    float metallic;
    float smoothness;
    vec4 emission_color;
    float emission_intensity;
    @texture2D @white
    uint albedo;
    // plain uints, NOT @texture2D: the cutout test only samples albedo, and
    // each extra @texture2D adds a bind-group entry the shadow pass does not
    // supply (webgpu validates arity strictly; metal tolerates it). same types
    // and offsets as standard.glsl so MaterialFS_unpack still resolves.
    uint normal_map;
    uint orm_map;
};

void main() {
    MaterialFS mat = MaterialFS_unpack(v_material_offset);
    // same threshold as the lit pass so the shadow silhouette matches exactly
    // what the lit pass keeps.
#ifdef HZ_RENDERER_ALPHA_CUTOUT
    if (texture_sample(albedo, mat.albedo, v_uv).a < 0.5) {
        discard;
    }
#endif
    // depth-only pass; color writes are disabled at the pipeline level.
    frag_color = vec4(0.0);
}
@end
