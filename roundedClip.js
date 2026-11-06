// SPDX-FileCopyrightText: Eidrien
// SPDX-License-Identifier: MIT
import Clutter from 'gi://Clutter';
import Cogl from 'gi://Cogl';
import GObject from 'gi://GObject';
import Shell from 'gi://Shell';

const declarations = 'uniform vec2 clip_size; uniform float clip_radius;';
// Signed distance to a rounded rectangle, with a soft one-pixel edge.
const fragment = `
    float r = min(clip_radius, min(clip_size.x, clip_size.y) * 0.5);
    vec2 q = abs(cogl_tex_coord_in[0].xy * clip_size - clip_size * 0.5)
        - (clip_size * 0.5 - vec2(r));
    float d = length(max(q, vec2(0.0))) + min(max(q.x, q.y), 0.0) - r;
    cogl_color_out *= 1.0 - smoothstep(-0.75, 0.75, d);
`;

function updateUniforms(effect, modern) {
    const [width, height] = effect.get_actor().get_size();
    const uniform = name => modern ? name : effect.get_uniform_location(name);
    effect.set_uniform_float(uniform('clip_size'), 2, [width, height]);
    effect.set_uniform_float(uniform('clip_radius'), 1, [effect.radius]);
}

// Register virtual methods in the class body: their base classes differ in 51.
export const RoundedClipEffect = Shell.GLSLEffect
    ? GObject.registerClass(class RoundedClipLegacy extends Shell.GLSLEffect {
        _init(radius) { super._init(); this.radius = radius; }

        vfunc_build_pipeline() {
            this.add_glsl_snippet(Cogl.SnippetHook?.FRAGMENT ?? Shell.SnippetHook.FRAGMENT,
                declarations, fragment, false);
        }

        vfunc_paint_target(node, context) {
            updateUniforms(this, false);
            super.vfunc_paint_target(node, context);
        }
    })
    : GObject.registerClass(class RoundedClipModern extends Clutter.ShaderEffect {
        _init(radius) { super._init(); this.radius = radius; }

        vfunc_get_static_snippet() {
            return Cogl.Snippet.new(Cogl.SnippetHook.FRAGMENT, declarations, fragment);
        }

        vfunc_paint_target(node, context) {
            updateUniforms(this, true);
            super.vfunc_paint_target(node, context);
        }
    });
