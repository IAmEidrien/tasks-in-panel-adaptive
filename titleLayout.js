// SPDX-FileCopyrightText: 2026 Eidrien
// SPDX-License-Identifier: MIT
import Pango from 'gi://Pango';
import St from 'gi://St';

// Hidden probe actors need not have synchronized Clutter margin properties.
const margins = actor => {
    const node = actor.get_theme_node();
    return node.get_margin(St.Side.LEFT) + node.get_margin(St.Side.RIGHT);
};

// At most 12 meaningful clusters are required by the setting. Retaining one
// extra distinguishes a short complete title from an elided longer one.
function ranges(layout, text) {
    if (typeof Intl.Segmenter !== 'function') {
        const chars = [...text];
        for (let length = 32; ; length *= 2) {
            const complete = length >= chars.length;
            const prefix = chars.slice(0, length).join('');
            const probe = layout.copy();
            probe.set_text(prefix, -1);
            const result = cursorRanges(probe, prefix);
            if (!complete) result.pop(); // The final cluster may be incomplete.
            if (complete || result.filter(r => r.meaningful).length >= 13) return result;
        }
    }
    return cursorRanges(layout, text);
}

function cursorRanges(layout, text) {
    const points = [0];
    let bytes = 0;
    for (const c of text) {
        bytes += c.codePointAt(0) <= 0x7f ? 1 : c.codePointAt(0) <= 0x7ff ? 2 : c.codePointAt(0) <= 0xffff ? 3 : 4;
        points.push(bytes);
    }
    let segments;
    if (typeof Intl.Segmenter === 'function') {
        let start = 0;
        segments = [...new Intl.Segmenter(undefined, {granularity: 'grapheme'}).segment(text)].map(s => {
            const length = [...s.segment].length;
            const segment = {start: points[start], end: points[start + length], meaningful: /\S/u.test(s.segment)};
            start += length; return segment;
        });
    } else {
        // Pango's cursor movement follows grapheme boundaries, including marks,
        // emoji sequences and Indic clusters. Walk both visual directions for
        // bidi text, then sort logical UTF-8 boundaries. LogAttr arrays are not
        // reliably introspectable in the GNOME 46 Pango typelib.
        const boundaries = new Set([0, bytes]);
        for (const direction of [-1, 1]) {
            let index = 0, trailing = 0;
            for (let n = 0; n < points.length * 4 + 4; n++) {
                const [next, after] = layout.move_cursor_visually(true, index, trailing, direction);
                if (next < 0 || next >= 0x7fffffff || (next === index && after === trailing)) break;
                const position = points.indexOf(next);
                if (position >= 0) boundaries.add(points[Math.min(points.length - 1, position + after)]);
                index = next; trailing = after;
            }
        }
        const sorted = [...boundaries].sort((a, b) => a - b), chars = [...text];
        segments = sorted.slice(1).map((end, i) => ({start: sorted[i], end,
            meaningful: /\S/u.test(chars.slice(points.indexOf(sorted[i]), points.indexOf(end)).join(''))}));
    }
    return segments;
}

export class TitleMeasure {
    constructor(parent) {
        this.root = new St.Widget({visible: false});
        parent.add_child(this.root);
        this.button = new St.Button({style_class: 'panel-button tip-task'});
        this.box = new St.BoxLayout();
        this.icon = new St.Icon({icon_size: 18, style: 'min-width: 18px; min-height: 18px;'});
        this.label = new St.Label();
        this.label.clutter_text.ellipsize = Pango.EllipsizeMode.END;
        this.box.add_child(this.icon); this.box.add_child(this.label);
        this.button.set_child(this.box); this.root.add_child(this.button);
    }

    measure(task, options) {
        const key = JSON.stringify([task.candidateText, task.candidateTitle, task.titleEligible,
            task.icon.visible, task.icon.gicon?.to_string(), options.weight, options.maxWidth,
            task.get_style_pseudo_class(), this.generation]);
        if (task.titleMetricsKey === key) return task.titleMetrics;
        this.button.set_style(null);
        this.button.set_style_pseudo_class(task.get_style_pseudo_class());
        this.label.set_style(options.weight === 'theme' ? null : `font-weight: ${options.weight};`);
        this.icon.gicon = task.icon.gicon ?? task.icon.fallback_gicon;
        this.icon.visible = task.icon.visible;
        // Obtain icon-only target dimensions from the existing theme, including
        // its padding and borders, rather than a hardcoded physical width.
        this.button.add_style_class_name('tip-task-icon-only'); this.label.hide();
        this.box.queue_relayout(); this.button.queue_relayout();
        const innerMargins = margins(this.box) + (this.icon.visible ? margins(this.icon) : 0);
        const iconWidth = this.button.get_preferred_width(-1)[1] + innerMargins;
        this.button.remove_style_class_name('tip-task-icon-only');
        this.label.text = task.candidateText; this.label.visible = Boolean(task.candidateText);
        this.label.queue_relayout(); this.box.queue_relayout(); this.button.queue_relayout();
        const [rawMinimum, rawNatural] = this.button.get_preferred_width(-1);
        // Clutter's box allocation subtracts child margins even though the
        // preferred-width query omits them. Include that real text-space cost.
        const childMargins = innerMargins + (this.label.visible ? margins(this.label) : 0);
        const minimum = rawMinimum + childMargins;
        const requestedNatural = rawNatural + childMargins;
        const layout = this.label.clutter_text.get_layout().copy();
        layout.set_width(-1); layout.set_ellipsize(Pango.EllipsizeMode.NONE);
        layout.set_text(task.candidateText, -1);
        const chrome = Math.max(0, requestedNatural - layout.get_pixel_size()[0]);
        // Before allocation Clutter's cached font name may round fractional
        // pixel sizes. Use the resolved theme font, as St does at allocation.
        layout.set_font_description(this.label.get_theme_node().get_font());
        const natural = Math.ceil(chrome + layout.get_extents()[1].width / Pango.SCALE);
        const scale = St.ThemeContext.get_for_stage(global.stage).scale_factor;
        const titleBytes = [...task.candidateTitle].reduce((n, c) => n +
            (c.codePointAt(0) <= 0x7f ? 1 : c.codePointAt(0) <= 0x7ff ? 2 : c.codePointAt(0) <= 0xffff ? 3 : 4), 0);
        const metrics = {id: task, app: task.appKey, iconWidth, fullNatural: Math.max(iconWidth, natural),
            title: task.titleEligible, minimum: Math.max(iconWidth, minimum),
            natural: Math.max(iconWidth, options.maxWidth < 0 ? natural : Math.min(natural, options.maxWidth * scale)),
            chrome, layout,
            clusters: ranges(layout, task.candidateText).filter(r => r.meaningful && r.end <= titleBytes)};
        metrics.minimum = Math.min(metrics.minimum, metrics.natural);
        task.titleMetricsKey = key;
        task.titleMetrics = metrics;
        return metrics;
    }

    invalidate() { this.generation = (this.generation ?? 0) + 1; }

    destroy() {
        this.root.destroy();
        this.root = this.button = this.box = this.icon = this.label = null;
    }
}

export function readableTitle(metrics, width, threshold) {
    const available = Math.max(0, width - metrics.chrome);
    const layout = metrics.layout;
    layout.set_width(Math.floor(available * Pango.SCALE));
    layout.set_ellipsize(Pango.EllipsizeMode.END);
    const hidden = [];
    const iterator = layout.get_iter();
    do {
        const run = iterator.get_run_readonly();
        if (run && (run.item.analysis.flags & (Pango.ANALYSIS_FLAG_IS_ELLIPSIS ?? 2)))
            hidden.push([run.item.offset, run.item.offset + run.item.length]);
    } while (iterator.next_run());
    const count = metrics.clusters.filter(c => !hidden.some(([a, b]) => c.start < b && c.end > a)).length;
    return count > 0 && (count === metrics.clusters.length || count >= threshold);
}
