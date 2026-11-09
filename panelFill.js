// SPDX-FileCopyrightText: Eidrien
// SPDX-License-Identifier: MIT
import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';

// Preserve GNOME's work-area-adjusted center; an empty center reserves no gap.
export function fillRegion(width, left, center, right, position, rtl, offset = 0) {
    const clamp = n => Math.max(0, Math.min(width, n));
    const middle = clamp((width + offset) / 2);
    const start = clamp(middle - center / 2), end = clamp(middle + center / 2);
    if (position === 'center') {
        const radius = Math.max(0, Math.min(middle - (rtl ? right : left),
            width - (rtl ? left : right) - middle));
        return [middle - radius, middle + radius];
    }
    const atStart = (position === 'left') !== rtl;
    if (atStart) return [0, Math.max(0, Math.min(width - (rtl ? left : right), center > 0 ? start : width))];
    return [Math.min(width, Math.max(rtl ? right : left, center > 0 ? end : 0)), width];
}

export const PanelFillConstraint = GObject.registerClass(class PanelFillConstraint extends Clutter.Constraint {
    _init(panel, position, layoutManager) {
        super._init();
        this.panel = panel;
        this.position = position;
        this.layoutManager = layoutManager;
    }

    vfunc_update_allocation(_actor, box) {
        const panel = this.panel;
        const width = panel.get_allocation_box().get_width();
        const natural = actor => actor.visible ? actor.get_preferred_width(-1)[1] : 0;
        const monitor = this.layoutManager.findMonitorForActor(panel);
        const work = monitor ? this.layoutManager.getWorkAreaForMonitor(monitor.index) : null;
        const offset = work ? 2 * (work.x - monitor.x) + work.width - monitor.width : 0;
        const [x1, x2] = fillRegion(width, natural(panel._leftBox), natural(panel._centerBox),
            natural(panel._rightBox), this.position,
            panel.get_text_direction() === Clutter.TextDirection.RTL, offset);
        box.x1 = Math.floor(x1);
        box.x2 = Math.floor(x2);
    }
});
