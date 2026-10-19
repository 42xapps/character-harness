#include "renderer.glsl"
#include "nature_wind_common.glsl"

@vs
#define HZ_RENDERER_VERTEX_SHADER
#define HZ_RENDERER_SKINNED     // hz_bones + apply_skinning
#define HZ_RENDERER_BLENDSHAPED // hz_bs_* + apply_blendshapes
#include "renderer_shaders.glsl"
invariant gl_Position;
out vec3 v_normal;
out vec2 v_uv;
flat out uint v_material_offset;
void main() {
    VertexInstanceData v = unpack_instance_data();
    if (v.bone_offset != 0xFFFFFFFFu) {
        apply_skinning(v.pos, v.normal, v.tangent, v.bone_offset, v.vertex_base,
                       v.vertex_layout_flags);
    }
    apply_blendshapes(v.pos, v.vertex_index, v.bs_offsets_base,
                      v.bs_weights_offset);

    vec4 world_pos = v.model * vec4(v.pos, 1.0);
    world_pos = nature_wind_position(world_pos, v.color, nature_wind_frame.times.x);
    gl_Position = hz_instance_clip(v, world_pos);
    v_uv = v.uv;
    v_material_offset = v.material_offset;
    v_normal = hz_normal_to_world(v.model, v.normal);
}
@end

@fs
#undef HZ_RENDERER_VERTEX_SHADER
#define HZ_RENDERER_FRAGMENT_SHADER
#include "renderer_shaders.glsl"
in vec3 v_normal;
in vec2 v_uv;
flat in uint v_material_offset;
// the structure target: .rg the octahedral normal, .b the roughness (unknown here: 0)
layout(location = 0) out vec4 frag_normal;
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
    if (texture_sample(albedo, mat.albedo, v_uv).a < 0.5) discard;
    frag_normal = vec4(oct_encode_normal(normalize(v_normal)), 0.0, 0.0);
}
@end
