// Project-local foliage material adapted from the SDK standard material.
// The standard material über-shader. ONE shader, gated entirely by keywords; the
// renderer's default materials and all standard content select variants of this
// file via different keyword sets (see material .hzt `keywords`). Replaces the old
// standard_{static,skinned,blendshape}{,_unlit,_gbuffer,_transparent,...} family.
//
// Keyword axes (material keywords are injected into BOTH stages by the cook):
//   deform   : (none)=rigid / HZ_RENDERER_SKINNED / HZ_RENDERER_BLENDSHAPED (excl.)
//   output   : (none)=forward 1-MRT / HZ_RENDERER_GBUFFER 3-MRT (+motion vectors)
//                                     / +HZ_RENDERER_TAAU 6-MRT (requires GBUFFER)
//   shading  : (none)=lit PBR / HZ_RENDERER_UNLIT (N.L diffuse)
//   surface  : HZ_RENDERER_TRANSPARENT (alpha blend) / HZ_RENDERER_ALPHA_CUTOUT
//              (discard a<0.5; an alpha_to_coverage material's forward variant adds
//              HZ_RENDERER_ALPHA_COVERAGE_HW/_MASK) / HZ_RENDERER_DOUBLE_SIDED (backface normal flip)
//   lit subs : HZ_RENDERER_SHADOWS, HZ_RENDERER_LIGHTING_CLUSTERS, HZ_RENDERER_IBL,
//              HZ_RENDERER_FOG (LIGHTING_BASIC is auto-implied by SHADOWS/CLUSTERS)
#include "renderer.glsl"

@vs
// paired with standard_static_depth.glsl: the depth pre-pass writes depth
// with that shader and this one early-Z's against it with GREATER_EQUAL, so
// both must compute gl_Position identically. see the note there.
#define HZ_RENDERER_VERTEX_SHADER
#include "renderer_shaders.glsl"
invariant gl_Position;
out vec2 v_uv;
out vec4 v_color;
flat out uint v_material_offset;
#ifdef HZ_RENDERER_VIEW_MODES
flat out uint v_lod_level;
#endif
#ifdef HZ_RENDERER_DECALS
flat out uint v_decal_mask;
#endif
out vec3 v_normal;
#ifndef HZ_RENDERER_UNLIT
out vec3 v_world_pos;
out vec3 v_tangent;
out float v_bitangent_sign;
out float v_view_depth;
#endif
#ifdef HZ_RENDERER_GBUFFER
out vec4 v_clip_cur;
out vec4 v_clip_prev;
#endif

void main() {
    VertexInstanceData v = unpack_instance_data();
#ifdef HZ_RENDERER_GBUFFER
    vec3 bind_pos = v.pos; // captured before deformation for the prev (motion) path
#endif
#ifdef HZ_RENDERER_SKINNED
    apply_skinning(v.pos, v.normal, v.tangent, v.bone_offset, v.vertex_base, v.vertex_layout_flags);
#endif
#ifdef HZ_RENDERER_BLENDSHAPED
    apply_blendshapes(v.pos, v.vertex_index, v.bs_offsets_base, v.bs_weights_offset);
#endif

    vec4 world_pos = v.model * vec4(v.pos, 1.0);
    // RGB is authored wind data; only vegetation materials use this shader.
    float amplitude = clamp(v.color.r, 0.0, 1.0) * 0.08;
    float phase = v.color.g * 6.2831853;
    float tip = v.color.b;
    float sway = sin(hz_scene.time * 0.9 + phase)
               + 0.22 * sin(hz_scene.time * 1.6 + phase * 1.4);
    float flutter = sin(hz_scene.time * 3.2 + phase) * tip * tip * 0.08;
    world_pos.xz += vec2(0.94, 0.34) * amplitude * (sway + flutter);
    gl_Position = hz_instance_clip(v, world_pos); // jittered (raster)
    v_uv = v.uv;
    v_color = vec4(1.0);
    v_material_offset = v.material_offset;
#ifdef HZ_RENDERER_VIEW_MODES
    v_lod_level = v.lod_level;
#endif
#ifdef HZ_RENDERER_DECALS
    v_decal_mask = v.decal_mask;
#endif
    v_normal = hz_normal_to_world(v.model, v.normal);
#ifndef HZ_RENDERER_UNLIT
    v_world_pos = world_pos.xyz;
    v_tangent = normalize((v.model * vec4(v.tangent, 0.0)).xyz);
    v_bitangent_sign = v.bitangent_sign;
    v_view_depth = -(hz_scene.view * world_pos).z;
#endif

#ifdef HZ_RENDERER_GBUFFER
    HzVelocity vel = hz_instance_velocity(v, world_pos, hz_world_pos_prev(bind_pos, v));
    v_clip_cur = vel.clip_cur;
    v_clip_prev = vel.clip_prev;
#endif
}
@end

@fs
// the lit path reads hz_scene (camera/lights): every lit variant (incl. the bare one the
// cook always compiles) gets it; unlit doesn't read it, so glslang strips the unused block.
#undef HZ_RENDERER_VERTEX_SHADER
#define HZ_RENDERER_FRAGMENT_SHADER
#define HZ_RENDERER_LIGHTING_BASIC
#define HZ_RENDERER_OUTPUT
#include "renderer_shaders.glsl"
in vec2 v_uv;
in vec4 v_color;
flat in uint v_material_offset;
#ifdef HZ_RENDERER_VIEW_MODES
flat in uint v_lod_level;
#endif
#ifdef HZ_RENDERER_DECALS
flat in uint v_decal_mask;
#endif
in vec3 v_normal;
#ifndef HZ_RENDERER_UNLIT
in vec3 v_world_pos;
in vec3 v_tangent;
in float v_bitangent_sign;
in float v_view_depth;
#endif
#ifdef HZ_RENDERER_GBUFFER
in vec4 v_clip_cur;
in vec4 v_clip_prev;
#endif

@material
struct MaterialFS {
    vec4 color;
    float metallic;
    float smoothness;
    vec4 emission_color;      // normalized hue (cooker fills from glTF emissiveFactor)
    float emission_intensity; // magnitude; color.rgb * intensity == emissiveFactor
    @texture2D @white
    uint albedo;
    @texture2D @normal
    uint normal_map;
    @texture2D @orm
    uint orm_map;
};

void main() {
#ifdef HZ_RENDERER_VIEW_MODES
    hz_view_lod = v_lod_level;
#endif
    MaterialFS mat = MaterialFS_unpack(v_material_offset);
    vec4 albedo = texture_sample(albedo, mat.albedo, v_uv);
    // glTF COLOR_0 multiplies base color (and alpha), so it applies before the
    // cutout test. meshes without the attribute unpack to vec4(1.0), so this is
    // a no-op for them -- see VTXLAYOUT_HAS_COLOR in common.glsl.
    albedo *= v_color;
#if defined(HZ_RENDERER_ALPHA_COVERAGE_HW) || defined(HZ_RENDERER_ALPHA_COVERAGE_MASK)
    float coverage_a = hz_alpha_coverage(albedo.a, 0.5);
#elif defined(HZ_RENDERER_ALPHA_CUTOUT)
    if (albedo.a < 0.5) {
        discard;
    }
#endif

    HzVelocity vel = HZ_VELOCITY(v_clip_cur, v_clip_prev);
#ifdef HZ_RENDERER_TRANSPARENT
    float out_a = mat.color.a * albedo.a;
#elif defined(HZ_RENDERER_ALPHA_COVERAGE_HW) || defined(HZ_RENDERER_ALPHA_COVERAGE_MASK)
    float out_a = coverage_a;
#else
    float out_a = 1.0;
#endif

#ifdef HZ_RENDERER_UNLIT
    vec3 light_dir = normalize(vec3(-0.5, -0.7, -0.5));
    float diffuse = max(0.0, dot(v_normal, -light_dir));
    HzSurface s = hz_surface_default();
    s.normal = v_normal;
    hz_output_lit(vec4(diffuse * albedo.rgb * mat.color.rgb, out_a), s, vel);
#else
    // ---- build: material + textures -> HzSurface ----
    HzSurface s = hz_surface_default();
    vec3 tangent_normal = unpack_normal_bc5(texture_sample(normal_map, mat.normal_map, v_uv).rg);
    s.geo_normal = v_normal;
    s.normal = apply_normal_map(v_normal, v_tangent, v_bitangent_sign, tangent_normal);
#ifdef HZ_RENDERER_DOUBLE_SIDED
    if (!gl_FrontFacing) {
        s.normal = -s.normal;
        s.geo_normal = -s.geo_normal;
    }
#endif

    vec4 orm = texture_sample(orm_map, mat.orm_map, v_uv);
    s.albedo = albedo.rgb * mat.color.rgb;
    s.alpha = out_a;
    s.metallic = mat.metallic * orm.b;
    s.smoothness = mat.smoothness * (1.0 - orm.g);
    s.emission = mat.emission_color.rgb * mat.emission_intensity;

    // ---- modify ----
#ifdef HZ_RENDERER_DECALS
    hz_apply_decals(s, v_world_pos, gl_FragCoord.xy, v_decal_mask);
#endif
#ifdef HZ_RENDERER_GTAO
    s.ambient_occlusion = min(s.ambient_occlusion, hz_ao(gl_FragCoord.xy));
#endif

    // ---- shade + write ----
    hz_output(s, v_world_pos, v_view_depth, vel);
#endif // HZ_RENDERER_UNLIT
}
@end
