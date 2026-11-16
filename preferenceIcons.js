// SPDX-FileCopyrightText: 2026 Eidrien
// SPDX-License-Identifier: MIT
import Gtk from 'gi://Gtk';

// Private names keep the fallback search path from replacing theme artwork.
export function bindPageIcons(window, directory, pages) {
    const theme = Gtk.IconTheme.get_for_display(window.get_display());
    const path = directory.get_child('icons').get_path();
    if (!theme.get_search_path().includes(path)) theme.add_search_path(path);
    const sync = () => {
        for (const [page, preferred, fallback] of pages)
            page.icon_name = theme.has_icon(preferred) ? preferred : fallback;
    };
    let changed = 0;
    const start = () => {
        if (!changed) changed = theme.connect('changed', sync);
        sync();
    };
    window.connect('realize', start);
    window.connect('unrealize', () => {
        if (changed) theme.disconnect(changed);
        changed = 0;
    });
    if (window.get_realized()) start();
    else sync();
}
