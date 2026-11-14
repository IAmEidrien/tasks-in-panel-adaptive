// SPDX-FileCopyrightText: 2026 Eidrien
// SPDX-License-Identifier: MIT
import Gio from 'gi://Gio';
import St from 'gi://St';

export class IconIdentity {
    constructor() { this.theme = new St.IconTheme(); this.cache = new Map(); }
    clear() { this.theme.rescan_if_needed(); this.cache.clear(); }
    get(icon, scale) {
        const fallback = new Gio.ThemedIcon({name: 'application-x-executable-symbolic'});
        const key = `${scale}:${icon?.to_string() ?? 'fallback'}`;
        if (!this.cache.has(key)) {
            const info = gicon => this.theme.lookup_by_gicon_for_scale(gicon, 18, scale, 0);
            const resolved = (icon && info(icon)) || info(fallback);
            this.cache.set(key, resolved?.get_filename() ?? icon?.to_string() ?? 'fallback');
        }
        return this.cache.get(key);
    }
}
