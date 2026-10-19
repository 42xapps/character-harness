@reflect
struct NatureWindFrame { vec4 times; };
uniform _NatureWindFrame { NatureWindFrame nature_wind_frame; };

vec4 nature_wind_position(vec4 world_pos, vec4 color, float time) {
    float amplitude = clamp(color.r, 0.0, 1.0) * 0.08;
    float phase = color.g * 6.2831853;
    float tip = color.b;
    float sway = sin(time * 0.9 + phase) + 0.22 * sin(time * 1.6 + phase * 1.4);
    float flutter = sin(time * 3.2 + phase) * tip * tip * 0.08;
    world_pos.xz += vec2(0.94, 0.34) * amplitude * (sway + flutter);
    return world_pos;
}
